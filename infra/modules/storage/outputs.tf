output "profiles_bucket_name" {
  value = aws_s3_bucket.profiles.bucket
}

output "profiles_bucket_arn" {
  value = aws_s3_bucket.profiles.arn
}

output "data_lake_bucket_name" {
  value = aws_s3_bucket.data_lake.bucket
}

output "data_lake_bucket_arn" {
  value = aws_s3_bucket.data_lake.arn
}
