// Kamin Product Database
const KAMIN_PRODUCTS = {
    models: [
        { id: 'klassik-500', name: 'Klassik 500', price: 2499, image: '🔥', description: 'Klassischer Kaminofen, 5kW' },
        { id: 'modern-700', name: 'Modern 700', price: 3299, image: '🔥', description: 'Moderner Kaminofen, 7kW' },
        { id: 'panorama-800', name: 'Panorama 800', price: 4499, image: '🔥', description: 'Panorama-Kamin, 8kW' },
        { id: 'eck-600', name: 'Eck-Kamin 600', price: 3799, image: '🔥', description: 'Eckkamin, 6kW' },
        { id: 'wasserführend-900', name: 'Wasserführend 900', price: 5999, image: '🔥', description: 'Wasserführend, 9kW' }
    ],
    colors: [
        { id: 'schwarz', name: 'Schwarz Matt', hex: '#1a1a1a', price: 0 },
        { id: 'anthrazit', name: 'Anthrazit', hex: '#383838', price: 0 },
        { id: 'grau', name: 'Grau', hex: '#6b6b6b', price: 50 },
        { id: 'weiss', name: 'Weiß', hex: '#f5f5f5', price: 100 },
        { id: 'bordeaux', name: 'Bordeaux', hex: '#722f37', price: 150 }
    ],
    claddings: [
        { id: 'stahl', name: 'Stahl', price: 0, material: 'steel' },
        { id: 'speckstein', name: 'Speckstein', price: 450, material: 'soapstone' },
        { id: 'keramik', name: 'Keramik', price: 350, material: 'ceramic' },
        { id: 'naturstein', name: 'Naturstein', price: 650, material: 'natural-stone' },
        { id: 'sandstein', name: 'Sandstein', price: 550, material: 'sandstone' }
    ],
    accessories: [
        { id: 'drehplatte', name: 'Drehplatte', price: 199, icon: '🔄' },
        { id: 'holzfach', name: 'Holzfach', price: 149, icon: '🪵' },
        { id: 'warmhaltefach', name: 'Warmhaltefach', price: 179, icon: '🍽️' },
        { id: 'externe-luft', name: 'Externe Luftzufuhr', price: 129, icon: '💨' },
        { id: 'glasscheibe', name: 'Seitliche Glasscheibe', price: 299, icon: '🪟' },
        { id: 'kaminbesteck', name: 'Kaminbesteck-Set', price: 89, icon: '🧹' }
    ]
};

// Current configuration state
class ProductConfigurator {
    constructor() {
        this.config = {
            model: null,
            color: null,
            cladding: null,
            accessories: [],
            notes: '',
            measurements: {
                roomWidth: '',
                roomHeight: '',
                installPosition: ''
            }
        };
        this.previousConfig = null;
        this.listeners = [];
    }

    setModel(modelId) {
        this.previousConfig = { ...this.config };
        this.config.model = KAMIN_PRODUCTS.models.find(m => m.id === modelId);
        this.notifyChange();
    }

    setColor(colorId) {
        this.previousConfig = { ...this.config };
        this.config.color = KAMIN_PRODUCTS.colors.find(c => c.id === colorId);
        this.notifyChange();
    }

    setCladding(claddingId) {
        this.previousConfig = { ...this.config };
        this.config.cladding = KAMIN_PRODUCTS.claddings.find(c => c.id === claddingId);
        this.notifyChange();
    }

    toggleAccessory(accessoryId) {
        this.previousConfig = { ...this.config, accessories: [...this.config.accessories] };
        const index = this.config.accessories.findIndex(a => a.id === accessoryId);
        if (index > -1) {
            this.config.accessories.splice(index, 1);
        } else {
            const accessory = KAMIN_PRODUCTS.accessories.find(a => a.id === accessoryId);
            if (accessory) this.config.accessories.push(accessory);
        }
        this.notifyChange();
    }

    setNotes(notes) {
        this.config.notes = notes;
    }

    setMeasurements(measurements) {
        this.config.measurements = { ...this.config.measurements, ...measurements };
    }

    getTotalPrice() {
        let total = 0;
        if (this.config.model) total += this.config.model.price;
        if (this.config.color) total += this.config.color.price;
        if (this.config.cladding) total += this.config.cladding.price;
        this.config.accessories.forEach(a => total += a.price);
        return total;
    }

    getConfig() {
        return { ...this.config, totalPrice: this.getTotalPrice() };
    }

    loadConfig(config) {
        this.config = config;
        this.notifyChange();
    }

    onChange(callback) {
        this.listeners.push(callback);
    }

    notifyChange() {
        const configData = this.getConfig();
        this.listeners.forEach(cb => cb(configData, this.previousConfig));
    }

    getSummary() {
        const lines = [];
        if (this.config.model) lines.push(`Modell: ${this.config.model.name}`);
        if (this.config.color) lines.push(`Farbe: ${this.config.color.name}`);
        if (this.config.cladding) lines.push(`Verkleidung: ${this.config.cladding.name}`);
        if (this.config.accessories.length > 0) {
            lines.push(`Zubehör: ${this.config.accessories.map(a => a.name).join(', ')}`);
        }
        lines.push(`Gesamtpreis: ${this.getTotalPrice().toLocaleString('de-DE')} €`);
        return lines.join('\n');
    }
}

// Export for use
window.KAMIN_PRODUCTS = KAMIN_PRODUCTS;
window.ProductConfigurator = ProductConfigurator;
