data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${var.name_prefix}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_inline" {
  statement {
    sid    = "DynamoCrud"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:TransactWriteItems",
    ]
    resources = [
      var.table_arn,
      "${var.table_arn}/index/*",
    ]
  }

  statement {
    sid    = "SqsGameIngestion"
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
      "sqs:SendMessageBatch",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:DeleteMessageBatch",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = compact([
      var.game_ingestion_queue_arn,
      var.game_ingestion_dlq_arn,
      var.match_ai_analysis_queue_arn,
      var.match_ai_analysis_dlq_arn,
    ])
  }

  statement {
    sid    = "BedrockInvokeMatchAi"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
    ]
    resources = [
      "arn:aws:bedrock:*::foundation-model/${var.bedrock_model_id}",
      "arn:aws:bedrock:*:*:inference-profile/*",
      "arn:aws:bedrock:*:*:foundation-model/${var.bedrock_model_id}",
    ]
  }

  statement {
    sid    = "AppSyncPublish"
    effect = "Allow"
    actions = [
      "appsync:GraphQL",
    ]
    resources = ["arn:aws:appsync:*:*:apis/*"]
  }
}

resource "aws_iam_role_policy" "lambda_inline" {
  name   = "${var.name_prefix}-lambda-inline"
  role   = aws_iam_role.lambda_exec.id
  policy = data.aws_iam_policy_document.lambda_inline.json
}
