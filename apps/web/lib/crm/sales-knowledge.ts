/**
 * Sales Knowledge Base — Conoscenza commerciale da SENIOR
 *
 * NON e' un manuale. E' l'esperienza concreta di un venditore
 * con 10+ anni nel settore spedizioni/logistica.
 *
 * Ogni entry ha:
 * - context: QUANDO applicare questa conoscenza
 * - insight: la conoscenza vera e propria
 * - example: un esempio concreto del settore
 *
 * @module lib/crm/sales-knowledge
 */

// ============================================
// TYPES
// ============================================

export interface SalesKnowledgeEntry {
  id: string;
  category:
    | 'sector_insight'
    | 'objection_handling'
    | 'timing'
    | 'negotiation'
    | 'persuasion'
    | 'industry';
  tags: string[];
  context: string;
  insight: string;
  example?: string;
}

// ============================================
// KNOWLEDGE BASE
// ============================================

export const SALES_KNOWLEDGE: SalesKnowledgeEntry[] = [
  // ─── SETTORI (specifico spedizioni) ───────────────────

  {
    id: 'sector-ecommerce',
    category: 'sector_insight',
    tags: ['ecommerce', 'volume', 'resi', 'tracking'],
    context: 'Lead/prospect del settore e-commerce',
    insight:
      'E-commerce = volume alto, margini bassi. Pain principali: resi frequenti (15-30% del volume), tracking real-time obbligatorio per ridurre ticket assistenza, picchi Black Friday/Natale che triplicano i volumi. Leva: prezzo per volume + integrazione API + gestione resi automatizzata. NON vendere sul prezzo singolo, vendi sul costo totale per ordine consegnato (include ri-consegne e giacenze).',
    example:
      'Un e-commerce che spedisce 200 pacchi/mese con il 5% di giacenze perde circa €3.000/anno solo in ri-consegne e clienti persi. Il nostro tasso di giacenza sotto il 2% gli risparmia €1.800/anno.',
  },
  {
    id: 'sector-pharma',
    category: 'sector_insight',
    tags: ['pharma', 'farmaceutico', 'temperatura', 'compliance', 'affidabilita'],
    context: 'Lead/prospect del settore farmaceutico',
    insight:
      "Pharma non tratta MAI sul prezzo — tratta sull'affidabilita'. Compliance GDP obbligatoria, temperatura controllata, consegna entro 24h per urgenze. La domanda chiave non e' \"quanto costa?\" ma \"cosa succede se il pacco arriva fuori range di temperatura?\". Leva: SLA garantito + tracciabilita' completa + report conformita'. Ciclo decisionale lungo (2-3 mesi) ma fidelizzazione altissima.",
    example:
      'Il farmaceutico non ti chiede quanto costi, ti chiede cosa succede se il pacco arriva a 26 gradi. Rispondi con: "Abbiamo il tracking temperatura in tempo reale e il corriere viene penalizzato se esce dal range".',
  },
  {
    id: 'sector-food',
    category: 'sector_insight',
    tags: ['food', 'alimentare', 'deperibile', 'catena-freddo', 'weekend'],
    context: 'Lead/prospect del settore food & beverage',
    insight:
      "Food = deperibilita' come primo vincolo. Catena del freddo, finestre di consegna strette (mattina per ristoranti, pomeriggio per privati), consegna sabato spesso necessaria. Il costo di una consegna in ritardo non e' la ri-spedizione, e' la merce buttata. Leva: copertura sabato + consegna programmata + packaging isotermico.",
    example:
      "Un food delivery che perde il 3% delle consegne per ritardo brucia il margine di un mese intero se la merce e' deperibile. Con consegna programmata quel 3% diventa 0.5%.",
  },
  {
    id: 'sector-artigianato',
    category: 'sector_insight',
    tags: ['artigianato', 'fragile', 'alto-valore', 'assicurazione'],
    context: 'Lead/prospect del settore artigianato',
    insight:
      "Artigianato = merce fragile e/o alto valore, volumi bassi ma margini alti per spedizione. Assicurazione obbligatoria, imballo specializzato, tracciamento attento. Il cliente artigiano e' emotivamente legato al prodotto — un danno durante il trasporto e' percepito come personale. Leva: assicurazione inclusa nel prezzo + procedura di reso semplificata + imballo dedicato.",
    example:
      "Un ceramista che spedisce 20 pezzi/mese da €80-150 l'uno: una rottura al mese costa piu' del risparmio annuale su un corriere economico. Assicurazione all-risk inclusa vince sempre.",
  },
  {
    id: 'sector-industria',
    category: 'sector_insight',
    tags: ['industria', 'pallet', 'B2B', 'programmato'],
    context: 'Lead/prospect del settore industria',
    insight:
      "Industria = pallet e colli pesanti, ritiri programmati, consegne B2B con preavviso obbligatorio. Decisore spesso e' il responsabile logistica, non il titolare. Trattativa tecnica: servono tariffe pallet competitive, booking ricorrente, gestione consegne con appuntamento. Leva: integrazione con il loro ERP + ritiro programmato settimanale + tariffe pallet a scaglioni.",
    example:
      "Un'azienda manifatturiera che spedisce 15 pallet/settimana vuole ritiro fisso alle 16:00 e consegna con preavviso telefonico. Non gli importa del tracking app, vuole il telefono del corriere.",
  },
  {
    id: 'sector-logistica',
    category: 'sector_insight',
    tags: ['logistica', '3PL', 'white-label', 'competitor', 'volumi'],
    context: 'Lead/prospect del settore logistica/3PL',
    insight:
      "Attenzione: un 3PL e' un competitor potenziale. Vuole white-label, volumi enormi, margini ridotti al minimo. Ma se lo acquisisci, i volumi compensano i margini bassi. Leva: infrastruttura IT (API, dashboard multi-cliente, reportistica) + prezzi all'ingrosso. NON promettergli esclusivita' — offri flessibilita' multi-corriere.",
    example:
      "Un operatore logistico che gestisce 3 e-commerce e spedisce 2.000 pacchi/mese totali: il margine per pacco e' basso (€0.50-1), ma il volume garantisce €1.000-2.000/mese di ricavo fisso.",
  },
  {
    id: 'sector-altro-general',
    category: 'sector_insight',
    tags: ['altro', 'generico', 'primo-contatto'],
    context: 'Lead/prospect di settore generico o non classificato',
    insight:
      'Quando il settore non e\' chiaro, la prima domanda da fare e\': "Che tipo di merce spedite e con che frequenza?". Da questa risposta si capisce il profilo: se dice "pacchi piccoli 3 volte a settimana" e\' probabilmente artigianato/piccolo ecommerce. Se dice "bancali una volta a settimana" e\' industria. Qualifica prima, proponi dopo.',
    example:
      'Mai mandare un preventivo generico. Chiedi: "Quanto pesa mediamente un pacco? Dove spedite di piu\' (Italia, Europa)? Quante spedizioni al mese?".',
  },
  {
    id: 'sector-fashion',
    category: 'sector_insight',
    tags: ['moda', 'fashion', 'resi', 'stagionale'],
    context: 'Lead/prospect del settore moda/fashion',
    insight:
      "Fashion = e-commerce con resi ancora piu' alti (30-40%). Stagionalita' fortissima: saldi invernali/estivi, nuove collezioni, Black Friday. Packaging curato obbligatorio (il pacco e' parte del brand). Leva: gestione resi efficiente + packaging personalizzato + prezzi per i picchi.",
    example:
      "Un brand di moda online con 500 ordini/mese ha 150-200 resi. Se il reso costa €6 anziché €8, risparmia €300-400/mese — piu' del risparmio sulla spedizione di andata.",
  },

  // ─── OBIEZIONI (approccio senior, NON script) ────────

  {
    id: 'obj-troppo-caro',
    category: 'objection_handling',
    tags: ['prezzo', 'caro', 'costo', 'economico'],
    context: "Il prospect dice che il prezzo e' troppo alto",
    insight:
      'MAI giustificarsi sul prezzo. Mai. La risposta e\': "Rispetto a cosa?". Poi ricalcola il costo totale includendo giacenze, resi, tempo perso con corrieri che non rispondono, merce danneggiata. Il prezzo per spedizione e\' solo una parte del costo reale.',
    example:
      "Il corriere che costa €1 in meno a pacco ma ha il 3% di giacenze in piu' ti costa €150/mese in piu' su 200 spedizioni (considerando ri-consegna + cliente perso + tempo gestione).",
  },
  {
    id: 'obj-usiamo-gia-competitor',
    category: 'objection_handling',
    tags: ['competitor', 'fornitore', 'alternativa', 'gia-fornitore'],
    context: "Il prospect usa gia' un altro fornitore",
    insight:
      "Non attaccare MAI il competitor. Fai domandare: \"Perfetto, cosa funziona bene con [competitor]? E cosa miglioreresti?\". Il 70% delle aziende ha almeno un pain point non risolto col fornitore attuale. Il tuo lavoro e' scoprirlo, non venderti. Se non c'e' un vero pain, non forzare — pianta un seme e torna tra 3 mesi.",
    example:
      'Cliente: "Usiamo GLS". Tu: "Ottimo, come vi trovate con le consegne al sud?" — le isole e il meridione sono spesso un punto debole per molti corrieri, un\'ottima area dove trovare il pain point.',
  },
  {
    id: 'obj-devo-pensarci',
    category: 'objection_handling',
    tags: ['pensarci', 'decidere', 'tempo', 'non-pronto'],
    context: 'Il prospect dice che deve pensarci',
    insight:
      "Non insistere, ma non andartene a mani vuote. Pianta un seme concreto: offri un'analisi gratuita del costo medio per spedizione, un benchmark di settore, o un periodo di prova senza impegno. L'obiettivo e' dare un motivo concreto per ricontattarti.",
    example:
      '"Capisco, nel frattempo posso prepararle un\'analisi gratuita del suo costo medio per spedizione confrontato con la media del settore [settore]? Cosi\' ha dati concreti per decidere, senza impegno."',
  },
  {
    id: 'obj-volume-non-giustifica',
    category: 'objection_handling',
    tags: ['volume', 'piccolo', 'poche-spedizioni'],
    context: 'Il prospect pensa di non avere volume sufficiente',
    insight:
      "Break-even analysis. Mostra che anche 30 spedizioni/mese con €2-3 di risparmio a pacco fanno €720-1.080/anno. Spesso e' piu' del costo di una giornata di lavoro. E mostra la proiezione: \"Se crescete del 20% l'anno prossimo, il risparmio raddoppia\".",
    example:
      '"Anche con 30 spedizioni/mese, il risparmio medio di €2.50 a pacco sono €75/mese, cioe\' €900/anno. Con 50 spedizioni diventano €1.500. Consideri che il 60% dei nostri clienti ha raddoppiato il volume nel primo anno."',
  },
  {
    id: 'obj-non-e-il-momento',
    category: 'objection_handling',
    tags: ['momento', 'tempismo', 'non-ora'],
    context: "Il prospect dice che non e' il momento giusto",
    insight:
      'Non accettare un "non ora" generico. Collega a un evento concreto: "Quando sarebbe il momento giusto? Prima del picco di Natale? Dopo i saldi estivi?". Se il prospect da\' una data, hai un follow-up naturale. Se non la da\', probabilmente non e\' interessato — segna come freddo e riprova tra 3 mesi.',
    example:
      '"Capisco. Molti nostri clienti ecommerce attivano il servizio a settembre per essere pronti al picco natalizio. Vuole che la ricontatti a meta\' agosto per valutare i tempi?"',
  },
  {
    id: 'obj-mandami-email',
    category: 'objection_handling',
    tags: ['email', 'brochure', 'inviami'],
    context: "Il prospect chiede di mandare un'email/brochure",
    insight:
      "E' un \"no\" gentile nel 80% dei casi. Non mandare la solita brochure — sara' ignorata. Chiedi un'informazione concreta per personalizzare: \"Certamente, ma per inviarle qualcosa di utile e non l'ennesima brochure, mi aiuta capire: quante spedizioni fate al mese?\". Se risponde, hai un'apertura. Se non risponde, era un no.",
    example:
      "\"Certo! Per mandarle qualcosa di realmente utile e non il solito PDF generico, mi dice in che zona spedite di piu' e piu' o meno quanti pacchi al mese? Cosi' le preparo un preventivo su misura con confronto prezzi.\"",
  },
  {
    id: 'obj-contratto-in-corso',
    category: 'objection_handling',
    tags: ['contratto', 'vincolo', 'scadenza'],
    context: 'Il prospect ha un contratto in corso con un altro fornitore',
    insight:
      'Non spingere per la rescissione — e\' controproducente. Chiedi quando scade il contratto e segna un follow-up 2 mesi prima della scadenza. Nel frattempo offri un test parallelo: "Posso farle provare il servizio su un piccolo volume parallelo, senza toccare il contratto attuale?".',
    example:
      '"Perfetto, quando scade il contratto? A giugno? Allora la ricontatto ad aprile con un preventivo aggiornato. Nel frattempo, se vuole testare il servizio su 10-20 spedizioni parallele, possiamo farlo senza impegno."',
  },
  {
    id: 'obj-decisore-diverso',
    category: 'objection_handling',
    tags: ['decisore', 'titolare', 'capo', 'non-decido'],
    context: "Il contatto non e' il decisore finale",
    insight:
      'Non scavalcare il contatto. Rendilo il tuo alleato: "Capisco, cosa le servirebbe per presentare la nostra proposta internamente?". Prepara materiale che LUI possa presentare: confronto prezzi, case study del suo settore, stima risparmio annuale. Il contatto diventa il tuo venditore interno.',
    example:
      '"Le preparo un one-pager con il confronto prezzi e la stima di risparmio per [azienda], cosi\' lo puo\' presentare al responsabile. Le serve qualche dato aggiuntivo per essere convincente?"',
  },
  {
    id: 'obj-non-ci-interessa',
    category: 'objection_handling',
    tags: ['non-interessa', 'rifiuto', 'no-grazie'],
    context: "Il prospect dice che non e' interessato",
    insight:
      'Non insistere, ma capisci il perche\'. "Capisco, posso chiederle il motivo? E\' soddisfatto del servizio attuale o semplicemente non e\' il momento?". Se e\' soddisfatto, pianta un seme: "Perfetto, mi fa piacere. Se in futuro le servisse un confronto o un secondo fornitore di backup, sono a disposizione". Segna come lost con motivo e riprova tra 6 mesi.',
  },
  {
    id: 'obj-qualita-dubbi',
    category: 'objection_handling',
    tags: ['qualita', 'affidabilita', 'dubbio', 'referenza'],
    context: "Il prospect dubita della qualita' del servizio",
    insight:
      'Rispondi con dati, non promesse. "Il nostro tasso di consegna al primo tentativo e\' del 97%, la media di settore e\' il 93%". Offri referenze nel suo settore. Se possibile, offri un periodo di prova misurabile: "Provi 30 spedizioni, misuri il tasso di consegna e i tempi. Se non migliora, torna al suo fornitore".',
  },

  // ─── TIMING & FREQUENZA ──────────────────────────────

  {
    id: 'timing-giorni',
    category: 'timing',
    tags: ['giorno', 'orario', 'contatto', 'chiamata'],
    context: 'Decidere quando contattare un lead/prospect',
    insight:
      "Miglior giorno: martedi'-giovedi'. Lunedi' e' troppo pieno (riunioni, email arretrate), venerdi' e' gia' in modalita' weekend. Miglior orario: 10:00-11:30 (dopo il caffe' ma prima di pranzo) o 14:30-16:00 (dopo la digestione). MAI prima delle 9:00, MAI dopo le 17:00, MAI in pausa pranzo.",
  },
  {
    id: 'timing-followup',
    category: 'timing',
    tags: ['follow-up', 'frequenza', 'persistenza'],
    context: 'Pianificare la sequenza di follow-up',
    insight:
      'Regola del 3-7-14: primo follow-up 3 giorni dopo il contatto, secondo a 7 giorni, terzo a 14 giorni. Mai piu\' di 4 tentativi totali senza risposta. Dopo il quarto, attendi 3 mesi e riprova con un nuovo angolo (nuova offerta, benchmark settore, case study). Ogni follow-up deve aggiungere VALORE, non solo "volevo sapere se...".',
  },
  {
    id: 'timing-ciclo-decisionale',
    category: 'timing',
    tags: ['decisione', 'ciclo', 'dimensione-azienda'],
    context: 'Stimare il tempo di chiusura in base al tipo di azienda',
    insight:
      'Ciclo decisionale per dimensione: PMI/freelance 1-2 settimane (spesso il titolare decide al volo), media impresa 3-6 settimane (serve approvazione responsabile), corporate/PA 2-3 mesi (gara, budget, compliance). Adatta il ritmo di follow-up al ciclo: non pressare una corporate dopo 1 settimana, non abbandonare una PMI dopo 3 giorni.',
  },
  {
    id: 'timing-stagionalita',
    category: 'timing',
    tags: ['stagione', 'natale', 'picco', 'budget'],
    context: "Sfruttare la stagionalita' per acquisizione",
    insight:
      'Settembre-Novembre = picco acquisizione (tutti preparano il Natale). Gennaio = budget nuovo anno, le aziende rivedono i fornitori. Maggio-Giugno = prima dell\'estate, ultimo slot per contratti prima delle vacanze. Agosto = morto, non chiamare nessuno. Post-Epifania = momento perfetto per ricontattare i "ci penso" di settembre.',
  },
  {
    id: 'timing-urgenza-naturale',
    category: 'timing',
    tags: ['urgenza', 'picco', 'evento'],
    context: 'Creare urgenza naturale (mai falsa)',
    insight:
      'L\'urgenza funziona solo se e\' reale. Mai inventare scadenze false. Urgenze vere: "Le tariffe del corriere X aumentano dal 1° marzo", "I slot di ritiro nella vostra zona si riempiono entro meta\' settembre per Natale", "Il contratto promozionale e\' valido fino a fine mese". Se non c\'e\' urgenza vera, non forzarla — meglio un prospect convinto tra 1 mese che uno forzato che annulla dopo 2.',
  },

  // ─── NEGOZIAZIONE ────────────────────────────────────

  {
    id: 'nego-ancoraggio',
    category: 'negotiation',
    tags: ['ancoraggio', 'premium', 'prezzo', 'confronto'],
    context: 'Presentare le opzioni di prezzo',
    insight:
      'Presenta SEMPRE il pacchetto premium per primo. Il cervello umano ancora il giudizio sul primo numero che vede. Se parti da €12/pacco (premium con assicurazione inclusa) e poi offri €8/pacco (base), il base sembra un affare. Se parti da €8, qualsiasi upsell sara\' "troppo caro".',
    example:
      '"Per il vostro profilo abbiamo 3 opzioni: Premium a €11 con assicurazione all-risk e priorita\', Business a €8.50 con tracciamento completo, Base a €7 solo consegna. Il 70% dei clienti del vostro settore sceglie Business."',
  },
  {
    id: 'nego-volume-commitment',
    category: 'negotiation',
    tags: ['volume', 'impegno', 'sconto', 'commitment'],
    context: 'Il prospect chiede uno sconto',
    insight:
      'Mai dare uno sconto gratis. Ogni concessione richiede una contro-concessione: piu\' volume, contratto piu\' lungo, pagamento anticipato, referral. "Se mi garantisci 150 spedizioni/mese posso offrire il -12% invece del -8%". Il prospect che ottiene qualcosa in cambio di un impegno si sente partner, non cliente.',
    example:
      "\"Posso sicuramente migliorare il prezzo. Con un impegno di 100+ spedizioni/mese, scendiamo del 10%. Con 200+, del 15%. Oppure, se preferisce flessibilita' senza impegno minimo, il prezzo attuale include gia' il miglior rapporto qualita'/prezzo.\"",
  },
  {
    id: 'nego-trial',
    category: 'negotiation',
    tags: ['prova', 'trial', 'test', 'senza-impegno'],
    context: "Il prospect e' indeciso e vuole provare",
    insight:
      "30 giorni alle tue condizioni, senza impegno. \"Se in 30 giorni non migliora almeno una metrica (tempi, costi, servizio), tornate al vostro fornitore precedente senza penali\". Il trial funziona perche': 1) rimuove il rischio, 2) crea abitudine, 3) nel 80% dei casi il cliente resta perche' cambiare e' piu' faticoso che restare.",
    example:
      '"Le propongo questo: proviamo per 30 giorni con un piccolo volume (30-50 pacchi). Se non e\' soddisfatto del servizio, nessun vincolo e nessun costo aggiuntivo. Il 90% dei clienti in prova resta con noi."',
  },
  {
    id: 'nego-non-cedere-gratis',
    category: 'negotiation',
    tags: ['concessione', 'negoziazione', 'scambio'],
    context: 'Principio fondamentale di negoziazione',
    insight:
      "Non cedere MAI sul prezzo senza ottenere qualcosa in cambio. Ogni \"si'\" gratuito riduce il valore percepito del servizio. Se abbassi il prezzo senza condizioni, il prospect pensera' che il prezzo originale era gonfiato. Alternativa: offri di piu' allo stesso prezzo anziche' abbassare il prezzo (es. aggiungi assicurazione base, o ritiro il sabato).",
  },
  {
    id: 'nego-gia-venduto',
    category: 'negotiation',
    tags: ['chiusura', 'segnale', 'acquisto'],
    context: "Riconoscere quando il prospect e' pronto a chiudere",
    insight:
      'Quando il prospect dice "ok, ma solo se..." e\' GIA\' venduto mentalmente. Sta negoziando i dettagli, non il principio. Non riaprire la vendita — negozia il dettaglio e chiudi. Segnali: fa domande su implementazione ("quanto ci vuole ad attivare?"), chiede dettagli operativi ("il ritiro e\' tutti i giorni?"), confronta opzioni ("il Business e il Premium cosa cambia esattamente?").',
  },
  {
    id: 'nego-multi-carrier',
    category: 'negotiation',
    tags: ['multi-corriere', 'flessibilita', 'backup'],
    context: 'Usare il vantaggio multi-corriere come leva',
    insight:
      "\"Non vi leghiamo a un corriere solo. Se GLS ha problemi nella vostra zona, passiamo a BRT in 5 minuti\". La flessibilita' multi-corriere e' un vantaggio enorme: riduce il rischio del cliente, garantisce continuita', permette di ottimizzare costo/servizio per zona. E' l'argomento piu' forte contro i corrieri diretti.",
    example:
      '"Il vantaggio principale e\' che non siete vincolati: GLS per il nord Italia, BRT per le isole, Poste per i volumi. Se un corriere aumenta i prezzi, ne attiviamo un altro in giornata. Nessun downtime, nessun vincolo."',
  },

  // ─── PERSUASIONE & PSICOLOGIA ────────────────────────

  {
    id: 'pers-social-proof',
    category: 'persuasion',
    tags: ['social-proof', 'referenza', 'settore', 'numeri'],
    context: 'Costruire fiducia attraverso prove sociali',
    insight:
      'Il social proof funziona SOLO se e\' specifico per il settore del prospect. "Abbiamo 1000 clienti" non dice nulla. "Il 40% dei nostri reseller e-commerce ha raddoppiato il volume nei primi 6 mesi" e\' potente. Ancora meglio con nomi (se autorizzati): "L\'e-commerce [nome] e\' passato da 100 a 350 spedizioni/mese in 4 mesi con noi".',
    example:
      '"Nel settore [settore] serviamo [numero] aziende con un tasso di retention del 95%. Il nostro cliente medio [settore] risparmia il [X]% rispetto al prezzo diretto del corriere."',
  },
  {
    id: 'pers-loss-aversion',
    category: 'persuasion',
    tags: ['perdita', 'costo', 'rischio', 'giacenza'],
    context: "Usare la loss aversion per motivare l'azione",
    insight:
      "Le persone sono piu' motivate dal timore di perdere che dalla speranza di guadagnare. Non dire \"risparmi €200/mese\", di' \"ogni mese che passa perdi €200 in giacenze mal gestite\". Il costo dell'inazione e' piu' potente del beneficio dell'azione. Quantifica SEMPRE la perdita in euro concreti.",
    example:
      '"Ogni giacenza non gestita entro 48h costa mediamente €15 tra ri-consegna e cliente perso. Con 10 giacenze/mese sono €150 che bruciate. Il nostro sistema le notifica in tempo reale e le risolve in media in 4 ore."',
  },
  {
    id: 'pers-urgency-reale',
    category: 'persuasion',
    tags: ['urgenza', 'scadenza', 'offerta'],
    context: 'Creare urgenza senza essere disonesti',
    insight:
      "L'urgenza falsa distrugge la fiducia. L'urgenza reale la costruisce. Urgenze reali: aumenti tariffari del corriere (comunicati con anticipo), scadenza promozione di lancio, capacita' limitata nella zona (slot ritiro), stagionalita' (preparare il Natale). Se non c'e' urgenza vera, non inventarla — perdi credibilita'.",
    example:
      '"Le tariffe [corriere] aumentano del 5-8% dal 1° marzo, come ogni anno. Se attiviamo prima, blocchiamo il prezzo attuale per 12 mesi."',
  },
  {
    id: 'pers-value-framing',
    category: 'persuasion',
    tags: ['framing', 'valore', 'prezzo', 'percezione'],
    context: 'Riformulare il prezzo come investimento',
    insight:
      'Non presentare "€8 a spedizione" ma "€0.40 per prodotto consegnato al tuo cliente" (se il pacco medio contiene 20 prodotti). Oppure: "Per meno di un caffe\' al giorno, hai un servizio di spedizione completo con tracking, assicurazione e assistenza dedicata". Ancora: confronta con il costo del tempo — "Quanto tempo perdi a chiamare il corriere quando c\'e\' un problema?".',
  },
  {
    id: 'pers-reciprocita',
    category: 'persuasion',
    tags: ['reciprocita', 'gratis', 'valore', 'analisi'],
    context: 'Dare valore prima di chiedere qualcosa',
    insight:
      "Offri qualcosa di valore PRIMA di chiedere l'acquisto: analisi gratuita del costo medio per spedizione, benchmark di settore, report sulle performance del corriere attuale, consulenza sulla logistica. La reciprocita' e' il principio piu' potente: chi riceve si sente in debito. Ma deve essere valore REALE, non PDF generici.",
    example:
      "\"Le preparo gratuitamente un'analisi comparativa tra il suo costo attuale per spedizione e la media del settore [settore] nella sua zona. Nessun impegno — e' un report che puo' usare anche per rinegoziare col suo fornitore attuale.\"",
  },
  {
    id: 'pers-scarcity',
    category: 'persuasion',
    tags: ['scarsita', 'limitato', 'esclusivo'],
    context: "Usare la scarsita' legittima come leva",
    insight:
      "La scarsita' funziona se e' vera: slot ritiro giornaliero limitati (i corrieri hanno capacita' fissa per zona), posti nel programma partner, tariffe promozionali con budget definito. \"Abbiamo 3 slot ritiro disponibili per la vostra zona\" e' credibile. \"Offerta valida solo per le prossime 2 ore\" e' spam e distrugge la fiducia.",
  },

  // ─── INDUSTRY (dinamiche settore spedizioni) ─────────

  {
    id: 'ind-margini-corriere',
    category: 'industry',
    tags: ['margine', 'corriere', 'prezzo', 'trattativa'],
    context: 'Capire la struttura dei margini nel settore',
    insight:
      'I corrieri hanno margini tra il 5% e il 15% per i grandi clienti. Un reseller/aggregatore lavora con margini del 15-35% sul prezzo al pubblico. Il prezzo non e\' tutto: sovraprezzi nascosti (supplemento carburante 10-15%, supplemento zone disagiate, supplemento contrassegno) possono raddoppiare il costo percepito. Vendi trasparenza: "nessun costo nascosto, tutto incluso nel prezzo che vedi".',
  },
  {
    id: 'ind-tendenze',
    category: 'industry',
    tags: ['tendenza', 'mercato', 'futuro'],
    context: 'Conoscere le tendenze del settore per argomentare',
    insight:
      "Il mercato spedizioni in Italia cresce del 8-12% annuo (trainato dall'e-commerce). Tendenze: consegna same-day/next-day sempre piu' richiesta, punti di ritiro (locker) in crescita, sostenibilita' come criterio di scelta (corrieri green). Chi si posiziona ora su queste tendenze avra' un vantaggio competitivo tra 2-3 anni.",
  },
];

// ============================================
// FUNZIONI DI RICERCA
// ============================================

/**
 * Trova entry rilevanti per contesto (settore, situazione, tags)
 */
export function findRelevantKnowledge(
  sector?: string | null,
  situation?: string | null,
  tags?: string[]
): SalesKnowledgeEntry[] {
  let results = [...SALES_KNOWLEDGE];

  // Filtra per settore se specificato
  if (sector) {
    const sectorLower = sector.toLowerCase();
    results = results.filter(
      (e) =>
        e.tags.some((t) => t.toLowerCase().includes(sectorLower)) ||
        e.context.toLowerCase().includes(sectorLower)
    );
  }

  // Filtra per situazione (match parziale su context/insight)
  if (situation) {
    const sitLower = situation.toLowerCase();
    const sitWords = sitLower.split(/\s+/).filter((w) => w.length > 3);
    results = results.filter((e) => {
      const text = `${e.context} ${e.insight}`.toLowerCase();
      return sitWords.some((w) => text.includes(w));
    });
  }

  // Filtra per tags se specificati
  if (tags && tags.length > 0) {
    const tagsLower = tags.map((t) => t.toLowerCase());
    results = results.filter((e) => e.tags.some((t) => tagsLower.includes(t.toLowerCase())));
  }

  // Se nessun filtro, restituisci tutto
  if (!sector && !situation && (!tags || tags.length === 0)) {
    return results;
  }

  return results;
}

/**
 * Trova entry per categoria specifica
 */
export function findKnowledgeByCategory(
  category: SalesKnowledgeEntry['category']
): SalesKnowledgeEntry[] {
  return SALES_KNOWLEDGE.filter((e) => e.category === category);
}
