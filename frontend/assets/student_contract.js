(function attachStudentContract(global) {
    function extractErrorMessage(rawText, fallback = 'Request failed') {
        const text = String(rawText || '').trim();
        if (!text) return fallback;
        try {
            const payload = JSON.parse(text);
            if (payload && typeof payload === 'object') {
                const detail = payload.detail;
                if (typeof detail === 'string' && detail.trim()) return detail.trim();
                if (detail && typeof detail === 'object' && typeof detail.message === 'string' && detail.message.trim()) {
                    return detail.message.trim();
                }
                if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
            }
        } catch {}
        return text;
    }

    function isMissingEncounterResponse(status, detail) {
        if (status !== 404) return false;
        const text = String(detail || '').toLowerCase();
        return text.includes('encounter not found') || text.includes('not found');
    }

    function isFinishedEncounterResponse(status, detail) {
        if (status !== 409) return false;
        const text = String(detail || '').toLowerCase();
        return text.includes('encounter finished') || text.includes('finished');
    }

    function buildChatFormData({ message, includeTts, patientId, encounterId }) {
        const formData = new FormData();
        formData.append('message', message);
        if (includeTts) formData.append('include_tts', 'true');
        if (patientId) formData.append('patient_id', patientId);
        if (encounterId) formData.append('encounter_id', encounterId);
        return formData;
    }

    async function requestChatReply({
        message,
        sessionId,
        includeTts,
        patientId,
        encounterId,
        ensureActiveEncounter,
        onEncounterFinished,
    }) {
        const makeRequest = (activeEncounterId = encounterId) => fetch('/api/chat', {
            method: 'POST',
            body: buildChatFormData({
                message,
                includeTts,
                patientId,
                encounterId: activeEncounterId,
            }),
            headers: { 'X-Session-Id': sessionId },
        });

        let chatResponse = await makeRequest(encounterId);

        if (!chatResponse.ok) {
            const detail = await chatResponse.text().catch(() => '');
            if (encounterId && isFinishedEncounterResponse(chatResponse.status, detail)) {
                onEncounterFinished?.();
                throw new Error('Conversación finalizada');
            }
            if (encounterId && isMissingEncounterResponse(chatResponse.status, detail)) {
                const restartedEncounterId = await ensureActiveEncounter?.(patientId);
                chatResponse = await makeRequest(restartedEncounterId || encounterId);
            } else {
                throw new Error(detail || 'Chat failed');
            }
        }

        if (!chatResponse.ok) {
            const detail = await chatResponse.text().catch(() => '');
            if (encounterId && isFinishedEncounterResponse(chatResponse.status, detail)) {
                onEncounterFinished?.();
                throw new Error('Conversación finalizada');
            }
            throw new Error(detail || 'Chat failed');
        }

        return await chatResponse.json();
    }

    function getReplyText(payload) {
        return String(
            payload?.assistant_reply?.text
            || payload?.reply_text
            || payload?.chat?.response
            || payload?.chat?.text
            || payload?.response
            || payload?.assistant_message?.content
            || ''
        ).trim();
    }

    function getUserText(payload) {
        return String(
            payload?.transcript?.text
            || payload?.user_text
            || payload?.user_message?.content
            || ''
        ).trim();
    }

    function getAssistantMessageId(payload) {
        return (
            payload?.assistant_reply?.message_id
            || payload?.chat?.message_id
            || payload?.assistant_message?.message_id
            || ''
        );
    }

    function getTtsPayload(payload) {
        if (payload?.assistant_audio?.audio_url || payload?.assistant_audio?.audio_base64) {
            return {
                audio_base64: payload.assistant_audio.audio_base64 || null,
                audio_url: payload.assistant_audio.audio_url || null,
                content_type: payload.assistant_audio.content_type || 'audio/wav',
            };
        }
        if (payload?.tts) return payload.tts;
        if (payload?.chat?.audio_base64 || payload?.chat?.audio_url) {
            return {
                audio_base64: payload.chat.audio_base64 || null,
                audio_url: payload.chat.audio_url || null,
                content_type: payload.chat.content_type || 'audio/wav',
            };
        }
        if (payload?.assistant_message?.audio_url) {
            return {
                audio_base64: null,
                audio_url: payload.assistant_message.audio_url,
                content_type: 'audio/wav',
            };
        }
        return null;
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

    global.MedSimStudentContract = {
        buildChatFormData,
        extractErrorMessage,
        getAssistantMessageId,
        getMessageAudioPayload,
        getReplyText,
        getTtsPayload,
        getUserText,
        isFinishedEncounterResponse,
        isMissingEncounterResponse,
        requestChatReply,
    };
})(window);
