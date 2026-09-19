output "db_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "RDS Postgres connection endpoint"
}

output "redis_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "ElastiCache Redis primary endpoint"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}
