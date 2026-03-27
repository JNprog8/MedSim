(function attachStudentAudio(global) {
    let currentAudio = null;
    let currentMessageElement = null;

    function floatTo16BitPCM(float32Array) {
        const pcm = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i += 1) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        return pcm;
    }

    function mergeAudioChunks(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        return merged;
    }

    function encodeWavBlob(chunks, sampleRate) {
        const audioData = mergeAudioChunks(chunks);
        const pcmData = floatTo16BitPCM(audioData);
        const buffer = new ArrayBuffer(44 + pcmData.length * 2);
        const view = new DataView(buffer);
        const writeString = (offset, value) => {
            for (let i = 0; i < value.length; i += 1) {
                view.setUint8(offset + i, value.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + pcmData.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, pcmData.length * 2, true);

        let offset = 44;
        for (const sample of pcmData) {
            view.setInt16(offset, sample, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

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

    function playAudioFromUrl(url, { messageElement = null, revokeOnStop = false, onPlaybackState = null, onPlaybackError = null } = {}) {
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
            onPlaybackState?.('playing');
        };

        audio.onended = () => {
            if (revokeOnStop) {
                try { URL.revokeObjectURL(normalizedUrl); } catch {}
            }
            if (messageElement) {
                messageElement.classList.remove('playing');
            }
            if (currentMessageElement === messageElement) currentMessageElement = null;
            if (currentAudio === audio) currentAudio = null;
            onPlaybackState?.('ready');
        };

        currentAudio = audio;
        audio.play().catch((error) => {
            if (messageElement) {
                messageElement.classList.remove('playing');
            }
            onPlaybackState?.('error');
            onPlaybackError?.(error);
        });
        return audio;
    }

    function playAudioFromBase64(audioBase64, contentType = 'audio/mpeg', options = {}) {
        if (!audioBase64) return null;
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: contentType });
        const objectUrl = URL.createObjectURL(blob);
        return playAudioFromUrl(objectUrl, { ...options, revokeOnStop: true });
    }

    function attachAudioControls({
        messageElement,
        payload = null,
        onPlayStatus = null,
        onModeChange = null,
    }) {
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

        const safePayload = payload || {};
        const setStatus = (state) => {
            if (state === 'playing') status.textContent = 'Hablando';
            else if (state === 'error') status.textContent = 'Audio con error';
            else status.textContent = 'Audio listo';
            onPlayStatus?.(state, status);
        };

        if (safePayload.audio_url) {
            status.textContent = 'Audio listo';
            button.textContent = 'Repetir';
            button.addEventListener('click', () => {
                playAudioFromUrl(safePayload.audio_url, {
                    messageElement,
                    revokeOnStop: false,
                    onPlaybackState: setStatus,
                    onPlaybackError: (error) => {
                        console.warn('Audio playback failed:', error);
                        onModeChange?.('error', 'Audio: no se pudo reproducir');
                    },
                });
                onModeChange?.('backend', 'Audio: reproduciendo');
            });
        } else if (safePayload.audio_base64) {
            status.textContent = 'Audio listo';
            button.textContent = 'Repetir';
            button.addEventListener('click', () => {
                playAudioFromBase64(safePayload.audio_base64, safePayload.content_type, {
                    messageElement,
                    onPlaybackState: setStatus,
                    onPlaybackError: (error) => {
                        console.warn('Audio playback failed:', error);
                        onModeChange?.('error', 'Audio: no se pudo reproducir');
                    },
                });
                onModeChange?.('backend', 'Audio: reproduciendo');
            });
        } else {
            status.textContent = 'Sin audio';
            button.textContent = 'Sin audio';
            button.disabled = true;
        }

        meta.append(status, button);
        messageElement.appendChild(meta);
    }

    global.MedSimStudentAudio = {
        attachAudioControls,
        encodeWavBlob,
        playAudioFromBase64,
        playAudioFromUrl,
        stopCurrentAudioPlayback,
    };
})(window);
