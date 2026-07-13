output "queue_urls" {
  value = { for k, v in aws_sqs_queue.main : k => v.url }
}

output "queue_arns" {
  value = { for k, v in aws_sqs_queue.main : k => v.arn }
}

output "dlq_arns" {
  value = { for k, v in aws_sqs_queue.dlq : k => v.arn }
}

output "game_ingestion_queue_url" {
  value = aws_sqs_queue.main["game_ingestion"].url
}

output "game_ingestion_queue_arn" {
  value = aws_sqs_queue.main["game_ingestion"].arn
}

output "match_ai_analysis_queue_url" {
  value = try(aws_sqs_queue.main["match_ai_analysis"].url, "")
}

output "match_ai_analysis_queue_arn" {
  value = try(aws_sqs_queue.main["match_ai_analysis"].arn, "")
}
