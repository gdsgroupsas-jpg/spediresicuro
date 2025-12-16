import https from 'https';
import fs from 'fs';
import path from 'path';

// --- CONFIGURAZIONE COLLAUDO (Sandbox) ---
// Dal Manuale Utente API WS
const SANDBOX = {
    url: 'https://apid.gp.posteitaliane.it/dev/kindergarden/user/sessions',
    clientId: 'f9d2e1c4-5b6a-4a8d-9e0f-1c2b3a4d5e6f', // Esempio o credenziali pubbliche test se disponibili?
    // NOTA: Se non abbiamo credenziali test valide pubbliche, usiamo quelle vere OPPURE placeholder
    // per verificare almeno che l'endpoint risponda in modo coerente (es. 401 Unauthorized vs 404)
    // Se il manuale da credenziali specifiche, usale. Altrimenti usiamo ENV se prefissato.
    // Assumiamo che l'utente voglia testare SE il suo codice funziona su sandbox se ha le credenziali.
    // Se non le ha, questo test fallirà ma è previsto.
    clientId_manuale: 'TEST_CLIENT_ID', // Placeholder
    secretId_manuale: 'TEST_SECRET_ID', // Placeholder
    scope: 'https://postemarketplace.onmicrosoft.com/d6a78063-5570-4a87-bbd7-07326e6855d1/.default' // Scope produzione standard
};

// --- CONFIGURAZIONE PRODUZIONE ---
const PROD = {
    url: 'https://apiw.gp.posteitaliane.it/gp/internet/user/sessions',
    // Scope costante da manuale
    scope: 'https://postemarketplace.onmicrosoft.com/d6a78063-5570-4a87-bbd7-07326e6855d1/.default'
};

// --- LOAD ENV ---
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const data = fs.readFileSync(envPath, 'utf8');
            const env = {};
            data.split('\n').forEach(line => {
                const [k, ...v] = line.trim().split('=');
                if (k && v) env[k] = v.join('=').replace(/^["']|["']$/g, '');
            });
            return env;
        }
    } catch (e) { console.error('Error loading .env.local', e); }
    return process.env;
}

const env = loadEnv();

// Credenziali Produzione da ENV (o hardcoded se utente vuole inserirle qui per test rapido)
// CERCHIAMO LE VARIABILI DEL PROGETTO
// Di solito POSTE_CLIENT_ID o simili. Ma nel codice precedente usavamo DB.
// Qui per lo script "da tribunale", cerchiamo di leggere variabili note o chiediamo di editarle.
// Per ora proviamo a leggere POSTE_CLIENT_ID se esiste, altrimenti usiamo placeholder.

// TENTATIVO RECUPERO CREDENZIALI
// ATTENZIONE: Questo script gira lato server/locale.
const PROD_CREDS = {
    clientId: env.POSTE_CLIENT_ID || env.NEXT_PUBLIC_POSTE_CLIENT_ID || '30d7ded7-b9c9-44f8-beb6-c319a1d82995',
    secretId: env.POSTE_CLIENT_SECRET || env.POSTE_SECRET || 'INSERISCI_QUI_SECRET_ID'
};

// --- FUNZIONE DI TEST ---
function testEndpoint(name, url, creds) {
    return new Promise((resolve) => {
        console.log(`\n--- TEST ${name} ---`);
        console.log(`URL: ${url}`);

        // Sanitizzazione "Idiot-Proof"
        let cleanClientId = (creds.clientId || '').trim().replace(/\s+/g, '');
        let cleanSecretId = (creds.secretId || '').trim().replace(/\s+/g, '');

        console.log(`ClientID Length: ${cleanClientId.length}`);
        console.log(`SecretID Length: ${cleanSecretId.length}`);

        if (cleanClientId.length < 5 || cleanSecretId.length < 5) {
            console.log('⚠️  Credenziali mancanti o troppo corte. Salto richiesta.');
            resolve();
            return;
        }

        const payload = JSON.stringify({
            clientId: cleanClientId,
            secretId: cleanSecretId,
            scope: creds.scope || PROD.scope,
            grantType: 'client_credentials'
        });

        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'POSTE_clientID': cleanClientId,
                // 'Content-Length': Buffer.byteLength(payload) // Node lo fa automatico di solito, ma meglio esplicito se vogliamo essere pedanti
            }
        };

        const req = https.request(url, opts, (res) => {
            console.log(`Status Code: ${res.statusCode} ${res.statusMessage}`);

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log('Response Keys:', Object.keys(json));

                    if (json.access_token) {
                        console.log('✅ ACCESS_TOKEN RICEVUTO!');
                    } else {
                        console.log('❌ NESSUN TOKEN.');
                        if (json.error || json.error_description) {
                            console.log('Error:', json.error);
                            console.log('Desc:', json.error_description);
                        } else {
                            // Print raw if weird
                            console.log('Raw Body:', data.substring(0, 200));
                        }

                        // Trace IDs for Support
                        if (json.trace_id) console.log('Trace ID:', json.trace_id);
                        if (json.correlation_id) console.log('Correlation ID:', json.correlation_id);
                    }
                } catch (e) {
                    console.log('Response is not JSON:', data.substring(0, 100));
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error('❌ Network Error:', e.message);
            resolve();
        });

        req.write(payload);
        req.end();
    });
}

// --- ESECUZIONE ---
(async () => {
    console.log('🔍 ESECUZIONE DIAGNOSTICA POSTE (Tribunale)');

    // 1. TEST COLLAUDO (Se abbiamo credenziali manuale, altrimenti prova con quelle prod per vedere errore "wrong tenant" o simile)
    // Usiamo le credenziali PROD anche su Sandbox se non ne abbiamo altre, giusto per vedere come risponde.
    // Se il manuale ha credenziali pubbliche (spesso user=test pass=test), vanno messe qui.
    // Purtroppo senza manuale sottomano non so le credenziali sandbox esatte.
    // Usiamo PROD_CREDS anche per collaudo, sapendo che fallirà l'auth ma ci dirà se endpoint è vivo.
    await testEndpoint('COLLAUDO (Endpoint Test)', SANDBOX.url, {
        ...PROD_CREDS,
        scope: SANDBOX.scope || PROD.scope
    });

    // 2. TEST PRODUZIONE (Quello che conta)
    await testEndpoint('PRODUZIONE (Endpoint Reale)', PROD.url, PROD_CREDS);

    console.log('\n--- FINE DIAGNOSTICA ---');
    console.log('Se COLLAUDO risponde 200/400/401 coerenti, la rete è ok.');
    console.log('Se PRODUZIONE da AADSTS700016, il problema è SOLO account.');
})();
