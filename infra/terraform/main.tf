terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --- Networking ---
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "amrutam-${var.environment}-vpc" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "amrutam-${var.environment}-private-${count.index}" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "amrutam-${var.environment}-public-${count.index}" }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# --- RDS PostgreSQL (Multi-AZ for 99.95% availability target) ---
resource "aws_db_subnet_group" "main" {
  name       = "amrutam-${var.environment}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier             = "amrutam-${var.environment}-db"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.db_instance_class
  allocated_storage      = 100
  storage_encrypted      = true
  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  backup_retention_period = 7
  deletion_protection    = true
  username               = "amrutam"
  manage_master_user_password = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "amrutam-${var.environment}-final-snapshot"
}

# --- ElastiCache Redis ---
resource "aws_elasticache_subnet_group" "main" {
  name       = "amrutam-${var.environment}-redis-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "amrutam-${var.environment}-redis"
  description           = "Amrutam Redis cache and job queue"
  node_type              = var.redis_node_type
  num_cache_clusters     = 2
  automatic_failover_enabled = true
  subnet_group_name      = aws_elasticache_subnet_group.main.name
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}

# --- ECS Fargate ---
resource "aws_ecs_cluster" "main" {
  name = "amrutam-${var.environment}"
}

resource "aws_ecs_task_definition" "app" {
  family                   = "amrutam-app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  container_definitions    = jsonencode([
    {
      name  = "app"
      image = var.app_container_image
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment = [
        { name = "NODE_ENV", value = var.environment },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "amrutam/${var.environment}/database-url" },
        { name = "JWT_ACCESS_SECRET", valueFrom = "amrutam/${var.environment}/jwt-access-secret" },
      ]
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = "amrutam-app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.app_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets = aws_subnet.private[*].id
  }
}
