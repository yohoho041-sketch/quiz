/**
 * API client for the Offline Quiz Application.
 * Communicates with the local Python HTTP server.
 */

const API = {
  async getQuizzes() {
    const res = await fetch('/api/quizzes');
    if (!res.ok) throw new Error('Failed to fetch quizzes');
    const data = await res.json();
    return data.quizzes || [];
  },

  async getQuiz(id) {
    const res = await fetch(`/api/quizzes/${id}`);
    if (!res.ok) throw new Error('Quiz not found');
    const data = await res.json();
    return data.quiz;
  },

  async createQuiz(quizData) {
    const res = await fetch('/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quizData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create quiz');
    }
    return await res.json();
  },

  async updateQuiz(id, quizData) {
    const res = await fetch(`/api/quizzes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quizData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update quiz');
    }
    return await res.json();
  },

  async deleteQuiz(id) {
    const res = await fetch(`/api/quizzes/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete quiz');
    return await res.json();
  },

  async uploadImage(file) {
    // Standard multipart/form-data upload
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      // Fallback to base64 if multipart encountered any issue
      return await API.uploadImageBase64(file);
    }
    const data = await res.json();
    return data.url;
  },

  async uploadImageBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.png';
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: reader.result, extension: ext })
          });
          const data = await res.json();
          if (data.url) resolve(data.url);
          else reject(new Error(data.error || 'Upload failed'));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async recordAttempt(quizId, attemptData) {
    const res = await fetch(`/api/quizzes/${quizId}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attemptData)
    });
    if (!res.ok) throw new Error('Failed to save attempt');
    return await res.json();
  },

  async getAttempts(quizId) {
    const res = await fetch(`/api/quizzes/${quizId}/attempts`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.attempts || [];
  },

  async getAllAttempts() {
    const res = await fetch('/api/attempts');
    if (!res.ok) return [];
    const data = await res.json();
    return data.attempts || [];
  },

  async getAttemptDetail(attemptId) {
    const res = await fetch(`/api/attempts/${attemptId}`);
    if (!res.ok) throw new Error('Attempt details not found');
    const data = await res.json();
    return data.attempt;
  },

  async getStats() {
    const res = await fetch('/api/stats');
    if (!res.ok) return null;
    const data = await res.json();
    return data.stats;
  },

  async clearAllAttempts() {
    const res = await fetch('/api/attempts', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear history');
    return await res.json();
  },

  async deleteAttempt(attemptId) {
    const res = await fetch(`/api/attempts/${attemptId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete attempt');
    return await res.json();
  }
};
