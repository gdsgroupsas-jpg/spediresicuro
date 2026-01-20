# Known Issues

Questo documento traccia problemi noti e workaround.

---

## 🪟 Vitest Test Failure su Windows (Locale Only)

**Sintomo:**

```bash
npm run test:unit
# Error: No test suite found in file
# 44/44 test falliti
```

**Root Cause:**

- Bug noto di Vitest 4.x su Windows con path resolution
- Issue GitHub: [#2962](https://github.com/vitest-dev/vitest/issues/2962), [#847](https://github.com/vitest-dev/vitest/issues/847)

**Impact:**

- ❌ Test falliscono SOLO in ambiente Windows locale
- ✅ Test PASSANO in CI/CD (Linux/Ubuntu) - **questo è quello che conta**
- ✅ Codice e test sono corretti

**Workaround:**

1. **Opzione A (Raccomandata)**: Affidarsi ai test CI
   - I test vengono eseguiti automaticamente in GitHub Actions prima di ogni merge
   - CI è l'ambiente di riferimento per quality gates

2. **Opzione B**: Usare WSL2 (Windows Subsystem for Linux)

   ```bash
   # In WSL2:
   cd /mnt/c/Users/sigor/spediresicuro
   npm run test:unit  # Funziona in ambiente Linux
   ```

3. **Opzione C**: Downgrade temporaneo (non raccomandato)
   ```bash
   npm install -D vitest@0.28.4
   ```

**Status:** ⚠️ Accettato - Non blocca sviluppo, CI garantisce qualità

**Last Updated:** 2026-01-20
