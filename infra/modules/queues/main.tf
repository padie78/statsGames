locals {
  queues = {
    game_ingestion = {
      description        = "Game_Ingestion_Queue — webhooks de Fortnite/Roblox desacoplados."
      visibility_timeout = 60
    }
    match_ai_analysis = {
      description        = "MATCH_AI_ANALYSIS — post-match Bedrock coaching (Valorant)."
      visibility_timeout = 120
    }
  }
}

resource "aws_sqs_queue" "dlq" {
  for_each = local.queues

  name                       = "${var.name_prefix}-${replace(each.key, "_", "-")}-dlq"
  message_retention_seconds  = var.dlq_retention_seconds
  visibility_timeout_seconds = var.dlq_visibility_timeout_seconds
  sqs_managed_sse_enabled    = true

  tags = merge(var.tags, {
    Name        = "${var.name_prefix}-${replace(each.key, "_", "-")}-dlq"
    LogicalName = upper("${each.key}_DLQ")
    Layer       = "event-network"
  })
}

resource "aws_sqs_queue" "main" {
  for_each = local.queues

  name                       = "${var.name_prefix}-${replace(each.key, "_", "-")}"
  visibility_timeout_seconds = each.value.visibility_timeout
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = merge(var.tags, {
    Name        = "${var.name_prefix}-${replace(each.key, "_", "-")}"
    LogicalName = upper(each.key)
    Layer       = "event-network"
  })
}
