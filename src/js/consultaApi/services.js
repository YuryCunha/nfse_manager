// src/js/consultaApi/services.js

async function makeApiCall(url) {
  const response = await fetch(url);
  if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: `Erro HTTP ${response.status}` } }));
      throw new Error(errorData.error?.message || `Erro HTTP ${response.status}`);
  }
  return response.json();
}

function buildApiUrl(cpfCnpj, dataInicial, dataFinal, hash = null) {
  let url = `../../../Components/Api/get_api_notes.php?cpfCnpj=${cpfCnpj}&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
  if (hash) {
      url += `&hashProximaPagina=${hash}`;
  }
  return url;
}

export async function fetchAllPagesForCnpj(cpfCnpj, dataInicial, dataFinal, nomeFantasia, onProgress) {
  let notesForCnpj = [];
  let currentHash = null;
  let keepFetching = true;
  let page = 1;

  while (keepFetching) {
      onProgress(`Buscando ${nomeFantasia} (página ${page})...`);
      try {
          const data = await makeApiCall(buildApiUrl(cpfCnpj, dataInicial, dataFinal, currentHash));
          if (data.notas && data.notas.length > 0) {
              data.notas.forEach(n => {
                  n.nomeFantasia = nomeFantasia;
                  n.prestadorCnpj = n.prestador;
              });
              notesForCnpj.push(...data.notas);
          }
          
          if (data.hashProximaPagina) {
              currentHash = data.hashProximaPagina;
              page++;
              await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
              keepFetching = false;
          }
      } catch (error) {
          console.error(`Erro na paginação para ${cpfCnpj}:`, error);
          throw error;
      }
  }
  return notesForCnpj;
}

export async function requeueNote(rps, serie, cnpj) {
  const url = '../../../Components/Api/requeue_note.php';
  const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rps, serie, cnpj })
  };
  return await makeApiCall(url, options);
}