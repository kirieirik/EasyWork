# Send Quote Email - Supabase Edge Function

Denne edge function sender tilbud på e-post med PDF-vedlegg.

## Oppsett

### 1. Opprett konto hos Resend
1. Gå til [resend.com](https://resend.com) og opprett en gratis konto
2. Generer en API-nøkkel under "API Keys"
3. (Valgfritt) Verifiser ditt eget domene for å sende fra din egen e-postadresse

### 2. Installer Supabase CLI
```bash
npm install -g supabase
```

### 3. Logg inn på Supabase
```bash
supabase login
```

### 4. Link prosjektet
```bash
cd EasyWork
supabase link --project-ref <din-project-ref>
```

Du finner `project-ref` i Supabase dashboard URL: `https://app.supabase.com/project/<project-ref>`

### 5. Sett secret for Resend API
```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
```

### 6. Deploy edge function
```bash
supabase functions deploy send-quote-email
```

## Testing lokalt

For å teste lokalt:
```bash
supabase start
supabase functions serve send-quote-email --env-file .env.local
```

Opprett `.env.local` med:
```
RESEND_API_KEY=re_xxxxxxxxxxxx
```

## Bruk eget domene (anbefalt)

For produksjon bør du verifisere ditt eget domene i Resend:
1. Gå til Resend dashboard → Domains
2. Legg til domenet ditt (f.eks. `firma.no`)
3. Følg DNS-instruksjonene
4. Oppdater `from`-adressen i `index.ts` til f.eks. `tilbud@firma.no`

## Feilsøking

- **401 Unauthorized**: Sjekk at RESEND_API_KEY er satt korrekt
- **CORS-feil**: Sjekk at funksjonen er deployet og at corsHeaders er konfigurert
- **Rate limit**: Resend gratis plan har 100 e-poster/dag
