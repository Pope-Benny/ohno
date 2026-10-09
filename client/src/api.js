async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  boards: () => req('/api/boards'),
  createBoard: (name) => req('/api/boards', { method: 'POST', body: { name } }),
  updateBoard: (id, data) => req(`/api/boards/${id}`, { method: 'PATCH', body: data }),
  deleteBoard: (id) => req(`/api/boards/${id}`, { method: 'DELETE' }),

  createColumn: (boardId, name) =>
    req(`/api/boards/${boardId}/columns`, { method: 'POST', body: { name } }),
  updateColumn: (id, name) => req(`/api/columns/${id}`, { method: 'PATCH', body: { name } }),
  deleteColumn: (id) => req(`/api/columns/${id}`, { method: 'DELETE' }),
  reorderColumns: (boardId, columnIds) =>
    req(`/api/boards/${boardId}/columns/order`, { method: 'PATCH', body: { columnIds } }),

  createCard: (columnId, title) =>
    req(`/api/columns/${columnId}/cards`, { method: 'POST', body: { title } }),
  updateCard: (id, data) => req(`/api/cards/${id}`, { method: 'PATCH', body: data }),
  deleteCard: (id) => req(`/api/cards/${id}`, { method: 'DELETE' }),
  moveCard: (id, toColumnId, index) =>
    req(`/api/cards/${id}/move`, { method: 'PATCH', body: { toColumnId, index } }),

  whiteboard: (boardId) => req(`/api/boards/${boardId}/whiteboard`),
  saveWhiteboard: (boardId, data) =>
    req(`/api/boards/${boardId}/whiteboard`, { method: 'PUT', body: { data } }),
};
