# 🤖 DELEGA A CURSOR - Verifica Template Email Supabase

## 📋 ISTRUZIONI PER CURSOR

Vai in Supabase Dashboard → Auth → Email Templates → Confirm signup.

Cerca nel template: `SiteURL`, `RedirectTo`, `ConfirmationURL`.

**Output richiesto**: Incolla qui SOLO le righe del link/bottone di conferma.

**Deve essere esattamente**: `href="{{ .ConfirmationURL }}"`  
**NON devono esistere** altri link basati su `SiteURL`.

---

## 🔍 COSA CERCARE

### Link Corretto (✅)
```html
<a href="{{ .ConfirmationURL }}">Confirm your signup</a>
```

### Link Errati (❌)
```html
<a href="{{ .SiteURL }}">Confirm your signup</a>
<a href="{{ .SiteURL }}/auth/callback">Confirm your signup</a>
<a href="https://spediresicuro.vercel.app/auth/callback">Confirm your signup</a>
```

### Verifica Completa

1. Cerca `SiteURL` nel template (Ctrl+F / Cmd+F)
2. Cerca `RedirectTo` nel template
3. Cerca `ConfirmationURL` nel template
4. Verifica che TUTTI i link di conferma usino `{{ .ConfirmationURL }}`
5. Verifica che NON ci siano concatenazioni tipo `{{ .SiteURL }}/...`

---

## 📤 OUTPUT RICHIESTO

Incolla qui SOLO le righe del link/bottone di conferma dal template:

```
[Incolla qui]
```

Poi indica:
- ✅ **PASS**: Tutti i link usano `{{ .ConfirmationURL }}`
- ❌ **FAIL**: Trovato `{{ .SiteURL }}` o link hardcoded

