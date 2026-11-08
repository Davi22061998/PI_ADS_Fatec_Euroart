function mostrarMensagem(mensagem, tipo = 'info') {
    const el = document.getElementById('feedbackMessage');
    if (!el) {
        console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
        alert(mensagem);
        return;
    }

    el.textContent = mensagem;
    el.className = `feedback-message feedback-${tipo}`;
    el.style.display = 'block';

    const cores = {
        error: '#f44336',
        success: '#4caf50',
        info: '#2196f3',
        warning: '#ff9800'
    };

    el.style.color = '#fff';
    el.style.backgroundColor = cores[tipo] || '#333';
    el.style.padding = '10px';
    el.style.borderRadius = '6px';
    el.style.marginBottom = '15px';
    el.style.fontWeight = 'bold';
    el.style.fontSize = '0.9em';
}
