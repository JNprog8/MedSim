(function attachEvaluatorEncounterTranscript(global) {
  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function createTranscriptController({ transcriptEl }) {
    let currentAudio = null;
    let currentMessageElement = null;

    function stopCurrentAudioPlayback() {
      if (!currentAudio) return;
      try { currentAudio.pause(); } catch {}
      const objectUrl = currentAudio.dataset?.objectUrl;
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch {}
      }
      if (currentMessageElement) {
        currentMessageElement.classList.remove('playing');
        currentMessageElement = null;
      }
      currentAudio = null;
    }

    function playAudioFromUrl(url, messageElement = null, revokeOnStop = false) {
      const normalizedUrl = String(url || '').trim();
      if (!normalizedUrl) return null;
      stopCurrentAudioPlayback();
      const audio = new Audio(normalizedUrl);
      if (revokeOnStop) audio.dataset.objectUrl = normalizedUrl;
      audio.onplay = () => {
        if (messageElement) {
          messageElement.classList.add('playing');
          currentMessageElement = messageElement;
        }
      };
      audio.onended = () => {
        if (messageElement) messageElement.classList.remove('playing');
        if (revokeOnStop) {
          try { URL.revokeObjectURL(normalizedUrl); } catch {}
        }
        currentAudio = null;
        currentMessageElement = null;
      };
      audio.play().catch(() => {});
      currentAudio = audio;
      return audio;
    }

    function playAudioFromBase64(audioBase64, contentType = 'audio/mpeg', messageElement = null) {
      if (!audioBase64) return null;
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);
      return playAudioFromUrl(objectUrl, messageElement, true);
    }

    function attachAudioControls(messageElement, ttsPayload = null) {
      if (!messageElement) return;
      const existing = messageElement.querySelector('.message-audio-meta');
      if (existing) existing.remove();

      const meta = document.createElement('div');
      meta.className = 'message-audio-meta';

      const status = document.createElement('span');
      status.className = 'message-audio-status';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-audio-replay';

      const payload = ttsPayload || {};
      if (payload.audio_url) {
        status.textContent = 'Audio listo';
        button.textContent = 'Reproducir';
        button.addEventListener('click', () => playAudioFromUrl(payload.audio_url, messageElement, false));
      } else if (payload.audio_base64) {
        status.textContent = 'Audio listo';
        button.textContent = 'Reproducir';
        button.addEventListener('click', () => playAudioFromBase64(payload.audio_base64, payload.content_type, messageElement));
      } else {
        status.textContent = 'Sin audio';
        button.textContent = 'Sin audio';
        button.disabled = true;
      }

      meta.append(status, button);
      messageElement.appendChild(meta);
    }

    function addTranscript(role, content, ttsPayload = null, messageId = '') {
      const plainContent = content || '';
      const div = document.createElement('div');
      div.className = `tmsg ${role === 'user' ? 'user' : 'assistant'}`;
      if (messageId) div.dataset.messageId = messageId;
      div.dataset.role = role === 'user' ? 'user' : 'assistant';
      div.dataset.messageText = plainContent;
      div.innerHTML = `<div class="tmeta">${role === 'user' ? 'Estudiante' : 'Paciente'}</div><div>${escapeHtml(plainContent)}</div>`;
      attachAudioControls(div, ttsPayload);
      transcriptEl.appendChild(div);
    }

    function updateTranscriptAudio(messageId, ttsPayload) {
      if (!messageId) return;
      const selector = `[data-message-id="${messageId}"]`;
      const messageEl = transcriptEl.querySelector(selector);
      if (!messageEl) return;
      attachAudioControls(messageEl, ttsPayload);
    }

    function clearTranscript() {
      transcriptEl.innerHTML = '';
    }

    function collectMessageIds() {
      return new Set(
        Array.from(transcriptEl.querySelectorAll('[data-message-id]'))
          .map((el) => el?.dataset?.messageId || '')
          .filter(Boolean),
      );
    }

    return {
      addTranscript,
      clearTranscript,
      collectMessageIds,
      stopCurrentAudioPlayback,
      updateTranscriptAudio,
    };
  }

  global.MedSimEvaluatorEncounterTranscript = {
    createTranscriptController,
  };
})(window);
