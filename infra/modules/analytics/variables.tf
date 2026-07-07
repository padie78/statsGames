variable "name_prefix" {
  type = string
}

variable "data_lake_bucket_name" {
  type        = string
  description = "S3 bucket destino para archivos Parquet del Data Lake."
}

variable "data_lake_bucket_arn" {
  type = string
}
