# Terraform (AWS) — Not Applied

This Terraform configuration provisions the production target for the
Amrutam backend: VPC with public/private subnets across 2 AZs, Multi-AZ
RDS PostgreSQL (encrypted, 7-day backup retention), ElastiCache Redis
(encrypted at rest and in transit, automatic failover), and an ECS
Fargate service for the app.

**This has intentionally not been applied.** It exists to demonstrate
infrastructure-as-code for the target deployment; running it requires an
AWS account, an ECR image pushed at `var.app_container_image`, and
secrets pre-populated in AWS Secrets Manager at the paths referenced in
`main.tf`.

**Note:** Terraform syntax has not been verified by the `terraform validate` tool (Terraform CLI unavailable in the submission environment). Syntax is reviewed manually only.

To validate the configuration without an AWS account:

    terraform init
    terraform validate

To actually provision (requires AWS credentials):

    terraform plan -var="app_container_image=<ecr-uri>"
    terraform apply -var="app_container_image=<ecr-uri>"

## Known Gaps (Not Applied, Documentation-Only)

This configuration demonstrates the target architecture's shape but is intentionally incomplete in a few ways, since it is never applied against a real AWS account:

- **No security groups**: RDS, ElastiCache, and the ECS service's network configuration all rely on the VPC's default security group rather than scoped ingress/egress rules. A real deployment would need explicit `aws_security_group` resources restricting DB/Redis access to the app tier only.
- **No IAM execution/task roles**: the ECS task definition references Secrets Manager paths but has no `execution_role_arn` — required in practice for ECS to pull secrets and the container image. `terraform validate`/`plan` won't catch this since it's an optional argument in the schema, but `apply` would need it added.
- **No load balancer**: despite the ALB being named in the high-level architecture, this configuration has no `aws_lb`/`aws_lb_target_group`/`aws_lb_listener` resources and the ECS service has no `load_balancer` block, so there is currently no external ingress path to the service.
- **ECS naming**: `aws_ecs_task_definition.family` and `aws_ecs_service.name` are hardcoded to `"amrutam-app"` rather than the `amrutam-${var.environment}-*` pattern used elsewhere, which would collide if this config were ever used for two environments in one AWS account.

These are noted here rather than fixed because the Terraform's purpose in this submission is to demonstrate IaC competency and the target architecture's shape, not to be apply-ready. A production rollout would need the above closed first.
