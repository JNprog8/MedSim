(function attachEvaluatorEncounterContract(global) {
  async function fetchSegueCatalog(sessionId) {
    const resp = await fetch('/api/evaluations/catalog', {
      headers: { 'X-Session-Id': sessionId },
    });
    if (!resp.ok) {
      throw new Error(await resp.text().catch(() => 'No se pudo cargar el catalogo SEGUE'));
    }
    const data = await resp.json().catch(() => ({}));
    return Array.isArray(data.criteria) ? data.criteria : [];
  }

  function buildEmptyEvaluation({ criteria, encounterId, encounterMeta }) {
    const items = [];
    for (const criterion of (criteria || [])) {
      items.push({ id: criterion.id, value: 'nc', notes: '' });
    }
    const studentMeta = encounterMeta?.student || {};
    return {
      id: '',
      encounter_id: encounterId,
      patient_id: encounterMeta?.patient_id || '',
      student_id: encounterMeta?.student_id || '',
      student_name: studentMeta.name || '',
      student_identifier: studentMeta.student_identifier || '',
      evaluator_name: encounterMeta?.evaluator_name || '',
      items,
    };
  }

  function getMessageAudioPayload(message) {
    if (!message) return null;
    if (message.tts) return message.tts;
    if (message.audio_url) {
      return {
        audio_base64: null,
        audio_url: message.audio_url,
        content_type: 'audio/wav',
      };
    }
    return null;
  }

  global.MedSimEvaluatorEncounterContract = {
    buildEmptyEvaluation,
    fetchSegueCatalog,
    getMessageAudioPayload,
  };
})(window);
