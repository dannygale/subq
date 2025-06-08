# SubQ MCP Server Examples

This document provides practical examples of how to use the SubQ MCP Server.

## Basic Usage

### 1. Spawn a Simple Q Process

```
subq___spawn with task "What is the current date and time?"
```

This will create a new Q process and send it the specified task.

### 2. List All Running Processes

```
subq___list
```

Shows all currently running Q processes with their IDs, status, and tasks.

### 3. Get Process Output

```
subq___get_output with processId "your-process-id-here"
```

Retrieves the output from a specific Q process.

## AWS-Focused Examples

### Cost Analysis

```
subq___spawn with task "Analyze my AWS account costs for the last 30 days and provide optimization recommendations. Focus on EC2, S3, and RDS services."
```

### Security Audit

```
subq___spawn with task "Perform a security audit of my AWS infrastructure. Check IAM policies, security groups, S3 bucket policies, and identify potential vulnerabilities." and timeout 1800
```

### Infrastructure Review

```
subq___spawn with task "Review my AWS infrastructure and create a comprehensive report including resource utilization, cost optimization opportunities, and architectural recommendations."
```

## Parallel Processing Examples

### Multi-Service Analysis

```
# Spawn multiple processes for different services
subq___spawn with task "Analyze EC2 instances for cost optimization opportunities"
subq___spawn with task "Review S3 buckets for storage class optimization"
subq___spawn with task "Examine RDS instances for performance and cost improvements"
subq___spawn with task "Check Lambda functions for optimization opportunities"

# Check their progress
subq___list

# Get results from each process
subq___get_output with processId "process-id-1"
subq___get_output with processId "process-id-2"
subq___get_output with processId "process-id-3"
subq___get_output with processId "process-id-4"
```

### Regional Analysis

```
# Analyze different AWS regions in parallel
subq___spawn with task "Analyze AWS resources in us-east-1 region for cost optimization"
subq___spawn with task "Analyze AWS resources in us-west-2 region for cost optimization"
subq___spawn with task "Analyze AWS resources in eu-west-1 region for cost optimization"
```

## Interactive Examples

### Follow-up Questions

```
# Start an analysis
subq___spawn with task "Analyze my AWS CloudTrail logs for security insights"

# Wait for initial analysis, then send follow-up
subq___send_to with processId "your-process-id" and input "Focus specifically on failed login attempts and unusual API calls"

# Send another follow-up
subq___send_to with processId "your-process-id" and input "Can you also check for any privilege escalation attempts?"
```

### Iterative Development

```
# Start with infrastructure analysis
subq___spawn with task "Review my current AWS architecture and suggest improvements"

# After getting initial recommendations
subq___send_to with processId "your-process-id" and input "Can you create CloudFormation templates for the recommended changes?"

# Further refinement
subq___send_to with processId "your-process-id" and input "Include monitoring and alerting in the CloudFormation templates"
```

## Code Generation Examples

### CloudFormation Templates

```
subq___spawn with task "Generate a CloudFormation template for a highly available web application with Auto Scaling, Load Balancer, RDS database, and CloudFront distribution"
```

### Terraform Configurations

```
subq___spawn with task "Create Terraform configurations for a complete AWS environment including VPC, subnets, security groups, EC2 instances, and RDS database with best practices"
```

### Lambda Functions

```
subq___spawn with task "Generate Python Lambda functions for processing S3 events, including error handling, logging, and CloudWatch metrics"
```

## Monitoring and Cleanup

### Process Management

```
# Check status of all processes
subq___list

# Terminate a specific process if needed
subq___terminate with processId "your-process-id"

# Clean up all finished processes
subq___cleanup
```

### Long-Running Tasks

```
# Start a comprehensive analysis with extended timeout
subq___spawn with task "Perform a complete AWS Well-Architected Framework review of my infrastructure across all five pillars" and timeout 3600

# Check progress periodically
subq___get_output with processId "your-process-id"

# Send additional context if needed
subq___send_to with processId "your-process-id" and input "Please also include specific recommendations for each pillar with implementation steps"
```

## Advanced Use Cases

### Batch File Processing

```
# Process multiple configuration files
subq___spawn with task "Review and optimize this CloudFormation template" and workingDirectory "/path/to/templates"
subq___spawn with task "Analyze this Terraform configuration for best practices" and workingDirectory "/path/to/terraform"
subq___spawn with task "Review these Lambda function codes for optimization" and workingDirectory "/path/to/lambda"
```

### Custom Process IDs

```
# Use meaningful process IDs for easier management
subq___spawn with task "Analyze EC2 costs" and processId "ec2-cost-analysis"
subq___spawn with task "Review S3 storage" and processId "s3-storage-review"
subq___spawn with task "Check RDS performance" and processId "rds-performance-check"

# Easy to reference later
subq___get_output with processId "ec2-cost-analysis"
```

## Tips for Effective Usage

1. **Use descriptive tasks**: Be specific about what you want Q to analyze or generate
2. **Set appropriate timeouts**: Complex analyses may need longer timeouts
3. **Monitor process status**: Use `subq___list` to track progress
4. **Clean up regularly**: Use `subq___cleanup` to free resources
5. **Use parallel processing**: Spawn multiple processes for independent tasks
6. **Leverage follow-up questions**: Use `subq___send_to` for iterative refinement
