// Kamin Product Database - kamdi24 Sortiment
const KAMIN_PRODUCTS = {
    // Marken
    brands: [
        { id: 'wamsler', name: 'Wamsler', logo: '🏭', country: 'Deutschland' },
        { id: 'haas-sohn', name: 'Haas+Sohn', logo: '🏭', country: 'Österreich' },
        { id: 'la-nordica', name: 'La Nordica', logo: '🏭', country: 'Italien' },
        { id: 'justus', name: 'Justus', logo: '🏭', country: 'Deutschland' },
        { id: 'oranier', name: 'Oranier', logo: '🏭', country: 'Deutschland' },
        { id: 'olsberg', name: 'Olsberg', logo: '🏭', country: 'Deutschland' },
        { id: 'spartherm', name: 'Spartherm', logo: '🏭', country: 'Deutschland' },
        { id: 'austroflamm', name: 'Austroflamm', logo: '🏭', country: 'Österreich' },
        { id: 'edilkamin', name: 'Edilkamin', logo: '🏭', country: 'Italien' },
        { id: 'schmitzker', name: 'Schmitzker', logo: '🏭', country: 'Deutschland' }
    ],
    // Modelle mit Marken-Zuordnung
    models: [
        { id: 'wamsler-yuna', name: 'Yuna', brandId: 'wamsler', price: 899, power: '6 kW', efficiency: 'A+', style: 'Modern', description: 'Kompakter Kaminofen mit Naturstein' },
        { id: 'wamsler-opus', name: 'Opus', brandId: 'wamsler', price: 1299, power: '8 kW', efficiency: 'A+', style: 'Klassisch', description: 'Klassischer Dauerbrandofen' },
        { id: 'wamsler-montafon', name: 'Montafon', brandId: 'wamsler', price: 1599, power: '8 kW', efficiency: 'A+', style: 'Landhaus', description: 'Kaminofen mit Speckstein' },
        { id: 'haas-aruba', name: 'Aruba Easy', brandId: 'haas-sohn', price: 1199, power: '6 kW', efficiency: 'A+', style: 'Modern', description: 'Schlanker Kaminofen mit Woodstone' },
        { id: 'haas-rubus', name: 'Rubus', brandId: 'haas-sohn', price: 1899, power: '7 kW', efficiency: 'A+', style: 'Modern', description: 'Premium-Kaminofen mit Keramik' },
        { id: 'haas-pico', name: 'Pico', brandId: 'haas-sohn', price: 999, power: '5 kW', efficiency: 'A', style: 'Kompakt', description: 'Platzsparender Kaminofen' },
        { id: 'nordica-rossella', name: 'Rossella R1', brandId: 'la-nordica', price: 2499, power: '8 kW', efficiency: 'A+', style: 'Italienisch', description: 'Eleganter Kaminofen mit Majolika' },
        { id: 'nordica-fulvia', name: 'Fulvia', brandId: 'la-nordica', price: 1799, power: '6 kW', efficiency: 'A+', style: 'Klassisch', description: 'Gusseisen-Kaminofen' },
        { id: 'nordica-ester', name: 'Ester Forno', brandId: 'la-nordica', price: 2899, power: '9 kW', efficiency: 'A+', style: 'Küchenherd', description: 'Kaminofen mit Backfach' },
        { id: 'justus-faro', name: 'Faro 2.0', brandId: 'justus', price: 1399, power: '6 kW', efficiency: 'A+', style: 'Modern', description: 'Moderner Stahlkaminofen' },
        { id: 'justus-usedom', name: 'Usedom 7', brandId: 'justus', price: 1699, power: '7 kW', efficiency: 'A+', style: 'Skandinavisch', description: 'Kaminofen mit Speckstein' },
        { id: 'oranier-polar', name: 'Polar Neo', brandId: 'oranier', price: 2199, power: '7 kW', efficiency: 'A+', style: 'Modern', description: 'Premium-Kaminofen mit Glasfront' },
        { id: 'oranier-arena', name: 'Arena Aqua', brandId: 'oranier', price: 3999, power: '10 kW', efficiency: 'A+', style: 'Wasserführend', description: 'Wasserführender Kaminofen' },
        { id: 'olsberg-palena', name: 'Palena Compact', brandId: 'olsberg', price: 1599, power: '5 kW', efficiency: 'A+', style: 'Kompakt', description: 'Raumluftunabhängiger Kaminofen' },
        { id: 'spartherm-senso', name: 'Senso L', brandId: 'spartherm', price: 4499, power: '8 kW', efficiency: 'A+', style: 'Premium', description: 'Designer-Kaminofen mit Drehfunktion' },
        { id: 'austroflamm-clou', name: 'Clou Compact', brandId: 'austroflamm', price: 3299, power: '6 kW', efficiency: 'A+', style: 'Modern', description: 'Österreichischer Premium-Ofen' }
    ],
    // Farben
    colors: [
        { id: 'schwarz', name: 'Schwarz Matt', hex: '#1a1a1a', price: 0 },
        { id: 'anthrazit', name: 'Anthrazit', hex: '#383838', price: 0 },
        { id: 'grau', name: 'Grau', hex: '#6b6b6b', price: 50 },
        { id: 'weiss', name: 'Weiß', hex: '#f5f5f5', price: 100 },
        { id: 'bordeaux', name: 'Bordeaux', hex: '#722f37', price: 150 },
        { id: 'creme', name: 'Creme', hex: '#fffdd0', price: 100 },
        { id: 'pergamon', name: 'Pergamon', hex: '#f1e9d2', price: 120 }
    ],
    // Verkleidungen
    claddings: [
        { id: 'stahl', name: 'Stahl', price: 0, material: 'steel' },
        { id: 'speckstein', name: 'Speckstein', price: 450, material: 'soapstone', heatStorage: '8-12h' },
        { id: 'keramik', name: 'Keramik', price: 350, material: 'ceramic' },
        { id: 'naturstein', name: 'Naturstein', price: 650, material: 'natural-stone', heatStorage: '6-10h' },
        { id: 'sandstein', name: 'Sandstein', price: 550, material: 'sandstone', heatStorage: '4-8h' },
        { id: 'majolika', name: 'Majolika', price: 750, material: 'majolica' },
        { id: 'gusseisen', name: 'Gusseisen', price: 400, material: 'cast-iron', heatStorage: '2-4h' },
        { id: 'woodstone', name: 'Woodstone', price: 300, material: 'woodstone' }
    ],
    // Zubehör
    accessories: [
        { id: 'drehplatte', name: 'Drehplatte', price: 199, icon: '🔄' },
        { id: 'holzfach', name: 'Holzfach', price: 149, icon: '🪵' },
        { id: 'warmhaltefach', name: 'Warmhaltefach', price: 179, icon: '🍽️' },
        { id: 'externe-luft', name: 'Externe Luftzufuhr', price: 129, icon: '💨' },
        { id: 'glasscheibe', name: 'Seitliche Glasscheibe', price: 299, icon: '🪟' },
        { id: 'kaminbesteck', name: 'Kaminbesteck-Set', price: 89, icon: '🧹' },
        { id: 'bodenplatte', name: 'Funkenschutz-Bodenplatte', price: 149, icon: '🛡️' },
        { id: 'ofenrohr-set', name: 'Ofenrohr-Set', price: 199, icon: '🔧' },
        { id: 'aschesauger', name: 'Aschesauger', price: 129, icon: '🧹' },
        { id: 'holzkorb', name: 'Holzkorb Leder', price: 79, icon: '🧺' }
    ]
};

// Current configuration state
class ProductConfigurator {
    constructor() {
        this.config = {
            brand: null,
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

    setBrand(brandId) {
        this.previousConfig = { ...this.config };
        this.config.brand = KAMIN_PRODUCTS.brands.find(b => b.id === brandId);
        this.config.model = null; // Reset model when brand changes
        this.notifyChange();
    }

    getModelsForBrand(brandId) {
        return KAMIN_PRODUCTS.models.filter(m => m.brandId === brandId);
    }

    setModel(modelId) {
        this.previousConfig = { ...this.config };
        this.config.model = KAMIN_PRODUCTS.models.find(m => m.id === modelId);
        // Auto-set brand if not set
        if (this.config.model && !this.config.brand) {
            this.config.brand = KAMIN_PRODUCTS.brands.find(b => b.id === this.config.model.brandId);
        }
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
        if (this.config.brand) lines.push(`Marke: ${this.config.brand.name}`);
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
