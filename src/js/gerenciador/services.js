// src/js/gerenciador/services.js

async function makeApiCall(url, options = {}) {
  try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) {
          throw new Error(data.error || `Erro HTTP ${response.status}`);
      }
      return data;
  } catch (error) {
      console.error('API Call Error:', error);
      throw error;
  }
}

export async function fetchNotesFromDb(status, startDate, endDate, includedCnpjs) {
  const url = `Components/API/get_notes.php?status=${status}&startDate=${startDate}&endDate=${endDate}&included_cnpjs=${JSON.stringify(includedCnpjs)}`;
  return await makeApiCall(url);
}

export async function sendAllPendingNotes(includedCnpjs) {
  const url = 'Components/Jobs/send_all_notes.php';
  const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ included_cnpjs })
  };
  return await makeApiCall(url, options);
}

export async function updateNoteStatus(noteId, action) {
  const url = 'Components/API/update_note_status.php';
  const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId, action })
  };
  return await makeApiCall(url, options);
}