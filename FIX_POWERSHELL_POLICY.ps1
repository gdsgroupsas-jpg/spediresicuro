# ============================================
# Script per Abilitare Esecuzione Script PowerShell
# ============================================
# 
# Questo script abilita l'esecuzione degli script
# PowerShell sul tuo sistema (solo per l'utente corrente)
#
# ISTRUZIONI:
# 1. Apri PowerShell come Amministratore
# 2. Esegui: .\FIX_POWERSHELL_POLICY.ps1
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ABILITAZIONE ESECUZIONE SCRIPT POWERSHELL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se è eseguito come amministratore
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  ATTENZIONE: Non sei eseguito come Amministratore" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPZIONE 1: Abilita solo per l'utente corrente (CONSIGLIATO)" -ForegroundColor Cyan
    Write-Host "   Non serve essere amministratore" -ForegroundColor Gray
    Write-Host ""
    Write-Host "OPZIONE 2: Abilita per tutto il sistema" -ForegroundColor Cyan
    Write-Host "   Serve essere amministratore" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "   Scegli opzione (1 o 2)"
    
    if ($choice -eq "1") {
        Write-Host ""
        Write-Host "🔧 Abilitando esecuzione script per utente corrente..." -ForegroundColor Yellow
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
        Write-Host "   ✅ Completato!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Ora puoi eseguire gli script PowerShell normalmente" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Per l'opzione 2, devi eseguire PowerShell come Amministratore" -ForegroundColor Red
        Write-Host "   Clic destro su PowerShell > Esegui come amministratore" -ForegroundColor Yellow
        Write-Host "   Poi esegui di nuovo questo script" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✅ Eseguito come Amministratore" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔧 Abilitando esecuzione script per utente corrente..." -ForegroundColor Yellow
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    Write-Host "   ✅ Completato!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Ora puoi eseguire gli script PowerShell normalmente" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ FATTO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ora puoi eseguire:" -ForegroundColor Yellow
Write-Host "   .\RECUPERA_VARIABILI_VERCEL_AUTO.ps1" -ForegroundColor White
Write-Host ""



