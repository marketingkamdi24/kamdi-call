// Drawing and Measurement Tools for Video Consultation
class DrawingCanvas {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentTool = 'line';
        this.color = '#ff0000';
        this.lineWidth = 3;
        this.drawings = [];
        this.currentDrawing = null;
        this.startPoint = null;
        this.listeners = [];
        this.scale = 1;
    }

    init(width = 800, height = 600) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.className = 'drawing-canvas';
        this.ctx = this.canvas.getContext('2d');
        
        if (this.container) {
            this.container.appendChild(this.canvas);
        }

        this.setupEvents();
        return this;
    }

    attachToElement(element) {
        const rect = element.getBoundingClientRect();
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'auto';
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        element.style.position = 'relative';
        element.appendChild(this.canvas);
        this.redraw();
    }

    setupEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.onMouseDown({ offsetX: touch.clientX - this.canvas.offsetLeft, offsetY: touch.clientY - this.canvas.offsetTop });
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.onMouseMove({ offsetX: touch.clientX - this.canvas.offsetLeft, offsetY: touch.clientY - this.canvas.offsetTop });
        });
        this.canvas.addEventListener('touchend', (e) => this.onMouseUp(e));
    }

    getPoint(e) {
        return { x: e.offsetX, y: e.offsetY };
    }

    onMouseDown(e) {
        this.isDrawing = true;
        this.startPoint = this.getPoint(e);
        
        if (this.currentTool === 'freehand') {
            this.currentDrawing = {
                type: 'freehand',
                points: [this.startPoint],
                color: this.color,
                lineWidth: this.lineWidth
            };
        }
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
        
        const currentPoint = this.getPoint(e);
        
        if (this.currentTool === 'freehand') {
            this.currentDrawing.points.push(currentPoint);
            this.redraw();
            this.drawFreehand(this.currentDrawing);
        } else {
            this.redraw();
            this.drawPreview(currentPoint);
        }
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        const endPoint = e.offsetX !== undefined ? this.getPoint(e) : this.startPoint;
        
        if (this.currentTool === 'freehand') {
            this.drawings.push(this.currentDrawing);
        } else {
            const drawing = this.createDrawing(this.startPoint, endPoint);
            if (drawing) {
                this.drawings.push(drawing);
            }
        }
        
        this.currentDrawing = null;
        this.redraw();
        this.notifyChange();
    }

    createDrawing(start, end) {
        const drawing = {
            type: this.currentTool,
            start: start,
            end: end,
            color: this.color,
            lineWidth: this.lineWidth
        };

        // Calculate distance for measurement tools
        if (this.currentTool === 'measure' || this.currentTool === 'line') {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            drawing.length = Math.sqrt(dx * dx + dy * dy);
        }

        return drawing;
    }

    drawPreview(currentPoint) {
        this.ctx.save();
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.setLineDash([5, 5]);

        switch (this.currentTool) {
            case 'line':
            case 'measure':
                this.drawLine(this.startPoint, currentPoint, true);
                break;
            case 'rect':
                this.drawRect(this.startPoint, currentPoint);
                break;
            case 'circle':
                this.drawCircle(this.startPoint, currentPoint);
                break;
            case 'arrow':
                this.drawArrow(this.startPoint, currentPoint);
                break;
        }

        this.ctx.restore();
    }

    drawLine(start, end, showMeasurement = false) {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        if (showMeasurement || this.currentTool === 'measure') {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            
            // Draw measurement label
            this.ctx.save();
            this.ctx.fillStyle = this.color;
            this.ctx.font = 'bold 14px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#fff';
            this.ctx.strokeStyle = this.color;
            this.ctx.lineWidth = 3;
            const text = `${Math.round(length)} px`;
            this.ctx.strokeText(text, midX, midY - 10);
            this.ctx.fillText(text, midX, midY - 10);
            this.ctx.restore();

            // Draw end markers
            this.drawEndMarker(start);
            this.drawEndMarker(end);
        }
    }

    drawEndMarker(point) {
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = this.color;
        this.ctx.fill();
    }

    drawRect(start, end) {
        this.ctx.beginPath();
        this.ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    }

    drawCircle(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        
        this.ctx.beginPath();
        this.ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawArrow(start, end) {
        const headLength = 15;
        const angle = Math.atan2(end.y - start.y, end.x - start.x);

        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        // Arrow head
        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(
            end.x - headLength * Math.cos(angle - Math.PI / 6),
            end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
            end.x - headLength * Math.cos(angle + Math.PI / 6),
            end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fillStyle = this.color;
        this.ctx.fill();
    }

    drawFreehand(drawing) {
        if (drawing.points.length < 2) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = drawing.color;
        this.ctx.lineWidth = drawing.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
        
        for (let i = 1; i < drawing.points.length; i++) {
            this.ctx.lineTo(drawing.points[i].x, drawing.points[i].y);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawings.forEach(drawing => {
            this.ctx.save();
            this.ctx.strokeStyle = drawing.color;
            this.ctx.lineWidth = drawing.lineWidth;
            this.ctx.setLineDash([]);

            switch (drawing.type) {
                case 'line':
                case 'measure':
                    this.drawLine(drawing.start, drawing.end, drawing.type === 'measure');
                    break;
                case 'rect':
                    this.drawRect(drawing.start, drawing.end);
                    break;
                case 'circle':
                    this.drawCircle(drawing.start, drawing.end);
                    break;
                case 'arrow':
                    this.drawArrow(drawing.start, drawing.end);
                    break;
                case 'freehand':
                    this.drawFreehand(drawing);
                    break;
            }

            this.ctx.restore();
        });
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    setColor(color) {
        this.color = color;
    }

    setLineWidth(width) {
        this.lineWidth = width;
    }

    undo() {
        if (this.drawings.length > 0) {
            this.drawings.pop();
            this.redraw();
            this.notifyChange();
        }
    }

    clear() {
        this.drawings = [];
        this.redraw();
        this.notifyChange();
    }

    getDrawings() {
        return [...this.drawings];
    }

    loadDrawings(drawings) {
        this.drawings = drawings || [];
        this.redraw();
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    notifyChange() {
        const drawings = this.getDrawings();
        this.listeners.forEach(cb => cb(drawings));
    }

    toDataURL() {
        return this.canvas.toDataURL('image/png');
    }

    show() {
        if (this.canvas) this.canvas.style.display = 'block';
    }

    hide() {
        if (this.canvas) this.canvas.style.display = 'none';
    }
}

window.DrawingCanvas = DrawingCanvas;
