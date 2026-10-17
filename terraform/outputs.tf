output "iothub_hostname"   { value = azurerm_iothub.hub.hostname }
output "function_app_name" { value = azurerm_linux_function_app.func.name }
output "postgres_fqdn"     { value = azurerm_postgresql_flexible_server.pg.fqdn }
output "dashboard_url"     { value = "https://${azurerm_static_web_app.swa.default_host_name}" }
output "swa_deploy_token" {
  value     = azurerm_static_web_app.swa.api_key
  sensitive = true
}
