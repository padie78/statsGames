output "glue_database_name" {
  value = aws_glue_catalog_database.analytics.name
}

output "athena_workgroup_name" {
  value = aws_athena_workgroup.analytics.name
}

output "glue_crawler_name" {
  value = aws_glue_crawler.data_lake.name
}
