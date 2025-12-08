/**
 * Estrae errori dettagliati dal report Playwright
 */

const fs = require('fs');
const path = require('path');

function extractErrorFromReport() {
  try {
    // Leggi il report HTML
    const reportPath = path.join('playwright-report', 'index.html');
    if (!fs.existsSync(reportPath)) {
      return null;
    }
    
    const content = fs.readFileSync(reportPath, 'utf-8');
    
    // Estrai errori dal JSON embedded nel report
    const jsonMatch = content.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const errors = [];
        
        // Naviga nella struttura del report
        if (data.props && data.props.pageProps) {
          const tests = data.props.pageProps.tests || [];
          for (const test of tests) {
            if (test.results && test.results.length > 0) {
              for (const result of test.results) {
                if (result.status === 'failed' || result.status === 'timedOut') {
                  errors.push({
                    test: test.title,
                    error: result.error || result.message,
                    status: result.status
                  });
                }
              }
            }
          }
        }
        
        return errors.length > 0 ? errors : null;
      } catch (e) {
        // Fallback: estrai errori dal testo HTML
        const errorMatches = content.match(/Error:([^<]+)/gi) || 
                           content.match(/TimeoutError:([^<]+)/gi);
        return errorMatches;
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

if (require.main === module) {
  const errors = extractErrorFromReport();
  if (errors) {
    console.log(JSON.stringify(errors, null, 2));
  } else {
    console.log('Nessun errore trovato nel report');
  }
}

module.exports = { extractErrorFromReport };
