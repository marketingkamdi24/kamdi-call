// PDF Generation for Consultation Summary
class ConsultationSummary {
    constructor() {
        this.data = {
            customerName: '',
            beraterName: '',
            date: new Date(),
            duration: '',
            callType: '',
            checklist: [],
            chatMessages: [],
            productConfig: null,
            drawings: [],
            notes: '',
            nextSteps: [],
            appointmentDate: null
        };
    }

    setCustomerInfo(name) {
        this.data.customerName = name;
    }

    setBeraterInfo(name) {
        this.data.beraterName = name;
    }

    setCallInfo(duration, callType) {
        this.data.duration = duration;
        this.data.callType = callType;
    }

    setChecklist(items) {
        this.data.checklist = items;
    }

    setChatMessages(messages) {
        this.data.chatMessages = messages;
    }

    setProductConfig(config) {
        this.data.productConfig = config;
    }

    setDrawings(drawings) {
        this.data.drawings = drawings;
    }

    setNotes(notes) {
        this.data.notes = notes;
    }

    setNextSteps(steps) {
        this.data.nextSteps = steps;
    }

    setAppointment(date) {
        this.data.appointmentDate = date;
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    generateHTML() {
        const config = this.data.productConfig || {};
        
        return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Beratungs-Zusammenfassung - ${this.data.customerName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #e63946; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #1d3557; }
        .logo span { color: #e63946; }
        .meta { text-align: right; color: #666; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 18px; font-weight: 600; color: #1d3557; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { background: #f8f9fa; padding: 12px 15px; border-radius: 8px; }
        .info-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 16px; font-weight: 500; color: #1d3557; margin-top: 4px; }
        .product-config { background: linear-gradient(135deg, #1d3557 0%, #457b9d 100%); color: white; padding: 25px; border-radius: 12px; }
        .product-title { font-size: 22px; margin-bottom: 15px; }
        .product-details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .product-item { background: rgba(255,255,255,0.15); padding: 10px 15px; border-radius: 6px; }
        .product-label { font-size: 11px; opacity: 0.8; text-transform: uppercase; }
        .product-value { font-size: 15px; font-weight: 500; }
        .price-total { font-size: 28px; font-weight: bold; margin-top: 20px; text-align: right; }
        .checklist { list-style: none; }
        .checklist li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px; }
        .checklist li:last-child { border-bottom: none; }
        .check-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; }
        .check-icon.checked { background: #28a745; color: white; }
        .check-icon.unchecked { background: #e2e8f0; color: #999; }
        .chat-messages { max-height: 300px; overflow-y: auto; }
        .chat-msg { padding: 8px 12px; margin-bottom: 8px; border-radius: 8px; }
        .chat-msg.customer { background: #e3f2fd; margin-right: 20%; }
        .chat-msg.berater { background: #f5f5f5; margin-left: 20%; }
        .chat-sender { font-size: 11px; font-weight: 600; color: #666; }
        .chat-text { margin-top: 4px; }
        .next-steps { background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; }
        .next-steps ul { margin-left: 20px; margin-top: 10px; }
        .appointment { background: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin-top: 15px; }
        .notes { background: #f8f9fa; padding: 15px; border-radius: 8px; white-space: pre-wrap; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #666; font-size: 12px; }
        @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">kamdi<span>24</span> Beratung</div>
        <div class="meta">
            <div>Datum: ${this.formatDate(this.data.date)}</div>
            <div>Dauer: ${this.data.duration || 'N/A'}</div>
        </div>
    </div>

    <div class="section">
        <h2 class="section-title">📋 Beratungsübersicht</h2>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Kunde</div>
                <div class="info-value">${this.data.customerName || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Berater</div>
                <div class="info-value">${this.data.beraterName || 'N/A'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Anruftyp</div>
                <div class="info-value">${this.data.callType === 'video' ? '📹 Videoanruf' : '📞 Audioanruf'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Beratungs-ID</div>
                <div class="info-value">#${Date.now().toString(36).toUpperCase()}</div>
            </div>
        </div>
    </div>

    ${config.model ? `
    <div class="section">
        <h2 class="section-title">🔥 Produktkonfiguration</h2>
        <div class="product-config">
            <div class="product-title">${config.model?.name || 'Kein Modell gewählt'}</div>
            <div class="product-details">
                <div class="product-item">
                    <div class="product-label">Farbe</div>
                    <div class="product-value">${config.color?.name || '-'}</div>
                </div>
                <div class="product-item">
                    <div class="product-label">Verkleidung</div>
                    <div class="product-value">${config.cladding?.name || '-'}</div>
                </div>
                ${config.accessories?.length > 0 ? `
                <div class="product-item" style="grid-column: span 2;">
                    <div class="product-label">Zubehör</div>
                    <div class="product-value">${config.accessories.map(a => a.name).join(', ')}</div>
                </div>
                ` : ''}
            </div>
            <div class="price-total">Gesamtpreis: ${config.totalPrice?.toLocaleString('de-DE') || '0'} €</div>
        </div>
    </div>
    ` : ''}

    ${this.data.checklist.length > 0 ? `
    <div class="section">
        <h2 class="section-title">✅ Checkliste</h2>
        <ul class="checklist">
            ${this.data.checklist.map(item => `
                <li>
                    <span class="check-icon ${item.checked ? 'checked' : 'unchecked'}">${item.checked ? '✓' : ''}</span>
                    <span>${item.text}</span>
                </li>
            `).join('')}
        </ul>
    </div>
    ` : ''}

    ${this.data.notes ? `
    <div class="section">
        <h2 class="section-title">📝 Notizen</h2>
        <div class="notes">${this.data.notes}</div>
    </div>
    ` : ''}

    ${this.data.chatMessages.length > 0 ? `
    <div class="section">
        <h2 class="section-title">💬 Chat-Verlauf</h2>
        <div class="chat-messages">
            ${this.data.chatMessages.slice(-20).map(msg => `
                <div class="chat-msg ${msg.isCustomer ? 'customer' : 'berater'}">
                    <div class="chat-sender">${msg.sender}</div>
                    <div class="chat-text">${msg.text}</div>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    ${this.data.nextSteps.length > 0 ? `
    <div class="section">
        <h2 class="section-title">📌 Nächste Schritte</h2>
        <div class="next-steps">
            <ul>
                ${this.data.nextSteps.map(step => `<li>${step}</li>`).join('')}
            </ul>
        </div>
        ${this.data.appointmentDate ? `
        <div class="appointment">
            <strong>📅 Termin vereinbart:</strong> ${this.formatDate(this.data.appointmentDate)}
        </div>
        ` : ''}
    </div>
    ` : ''}

    <div class="footer">
        <p>kamdi24 GmbH - Videoberatung | Erstellt am ${this.formatDate(new Date())}</p>
        <p>Diese Zusammenfassung wurde automatisch generiert.</p>
    </div>
</body>
</html>`;
    }

    downloadPDF() {
        const html = this.generateHTML();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Open in new window for printing
        const printWindow = window.open(url, '_blank');
        printWindow.onload = () => {
            printWindow.print();
        };
    }

    downloadHTML() {
        const html = this.generateHTML();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Beratung_${this.data.customerName}_${new Date().toISOString().split('T')[0]}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    getData() {
        return { ...this.data };
    }
}

window.ConsultationSummary = ConsultationSummary;
