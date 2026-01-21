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
    // Modelle mit Marken-Zuordnung - kamdi24 Bestseller
    models: [
        // WAMSLER - 5 Modelle
        { id: 'wamsler-yuna', name: 'Yuna', brandId: 'wamsler', price: 899, power: '6 kW', efficiency: 'A+', style: 'Kompakt', description: 'Kompakter Kaminofen mit Naturstein und Warmhaltefach' },
        { id: 'wamsler-atlas', name: 'Atlas', brandId: 'wamsler', price: 1499, power: '8 kW', efficiency: 'A+', style: 'Speicherofen', description: 'Leistungsstarker Speicherofen mit 60kg Speichersteinen' },
        { id: 'wamsler-rocky', name: 'Rocky', brandId: 'wamsler', price: 1299, power: '7 kW', efficiency: 'A+', style: 'Klassisch', description: 'Massiver Gusseisen-Klassiker mit hoher Wärmespeicherung' },
        { id: 'wamsler-nizza', name: 'Nizza', brandId: 'wamsler', price: 1899, power: '6 kW', efficiency: 'A+', style: 'Drehbar', description: '360° drehbarer Kaminofen für offene Wohnkonzepte' },
        { id: 'wamsler-trion', name: 'Trion', brandId: 'wamsler', price: 1699, power: '8 kW', efficiency: 'A+', style: 'Panorama', description: 'Dreiseitige Verglasung für Flammengenuss' },
        { id: 'wamsler-nevada', name: 'N-Line Nevada', brandId: 'wamsler', price: 799, power: '5 kW', efficiency: 'A', style: 'Budget', description: 'Preis-Leistungs-Sieger mit Naturstein' },
        
        // HAAS+SOHN - 5 Modelle
        { id: 'haas-aruba', name: 'Aruba Easy', brandId: 'haas-sohn', price: 1199, power: '6 kW', efficiency: 'A+', style: 'Schmal', description: 'Nur 36,5cm tief - perfekt für kleine Räume' },
        { id: 'haas-rubus', name: 'Rubus', brandId: 'haas-sohn', price: 1899, power: '7 kW', efficiency: 'A+', style: 'Premium', description: 'Premium-Kaminofen mit eleganter Keramik' },
        { id: 'haas-pico', name: 'Pico', brandId: 'haas-sohn', price: 999, power: '5 kW', efficiency: 'A', style: 'Kompakt', description: 'Platzsparender Kaminofen für kleine Räume' },
        { id: 'haas-tirol', name: 'Tirol', brandId: 'haas-sohn', price: 1599, power: '6 kW', efficiency: 'A+', style: 'Kachelofen', description: 'Rustikaler Kachelofen mit Holzfach' },
        { id: 'haas-gastein', name: 'Gastein', brandId: 'haas-sohn', price: 2199, power: '8 kW', efficiency: 'A+', style: 'Speicher', description: 'Speicherofen mit langer Wärmeabgabe' },
        
        // LA NORDICA - 5 Modelle
        { id: 'nordica-rossella', name: 'Rossella R1', brandId: 'la-nordica', price: 2499, power: '8 kW', efficiency: 'A+', style: 'Majolika', description: 'Eleganter Kaminofen mit handgefertigter Majolika' },
        { id: 'nordica-fulvia', name: 'Fulvia', brandId: 'la-nordica', price: 1799, power: '6 kW', efficiency: 'A+', style: 'Gusseisen', description: 'Klassischer Gusseisen-Kaminofen' },
        { id: 'nordica-ester', name: 'Ester Forno', brandId: 'la-nordica', price: 2899, power: '9 kW', efficiency: 'A+', style: 'Backfach', description: 'Kaminofen mit integriertem Backfach' },
        { id: 'nordica-concita', name: 'Concita 2.0', brandId: 'la-nordica', price: 2299, power: '12 kW', efficiency: 'A+', style: 'Leistung', description: 'Starke 12kW Leistung mit Bordeaux-Majolika' },
        { id: 'nordica-norma', name: 'Norma S Idro', brandId: 'la-nordica', price: 3499, power: '15 kW', efficiency: 'A+', style: 'Wasserführend', description: 'Wasserführend mit Majolika-Keramik' },
        
        // JUSTUS - 5 Modelle
        { id: 'justus-faro', name: 'Faro 2.0', brandId: 'justus', price: 1399, power: '6 kW', efficiency: 'A+', style: 'Modern', description: 'Moderner Stahlkaminofen mit Dreifach-Luftsystem' },
        { id: 'justus-usedom', name: 'Usedom 7', brandId: 'justus', price: 1699, power: '7 kW', efficiency: 'A+', style: 'Speckstein', description: 'Kaminofen mit Speckstein-Verkleidung' },
        { id: 'justus-austin', name: 'Austin 7', brandId: 'justus', price: 1299, power: '7 kW', efficiency: 'A+', style: 'Klassisch', description: 'Klassischer Kaminofen mit 24h-Dauerbrand' },
        { id: 'justus-island', name: 'Island 7 Aqua', brandId: 'justus', price: 2999, power: '7 kW', efficiency: 'A+', style: 'Wasserführend', description: 'Wasserführender Kaminofen für Zentralheizung' },
        { id: 'justus-seeland', name: 'Seeland 7', brandId: 'justus', price: 1599, power: '7 kW', efficiency: 'A+', style: 'Skandinavisch', description: 'Skandinavisches Design mit Speckstein' },
        
        // ORANIER - 5 Modelle
        { id: 'oranier-polar', name: 'Polar Neo', brandId: 'oranier', price: 2199, power: '7 kW', efficiency: 'A+', style: 'Modern', description: 'Premium-Kaminofen mit großer Glasfront' },
        { id: 'oranier-polar-eck', name: 'Polar Eck', brandId: 'oranier', price: 2969, power: '7 kW', efficiency: 'A+', style: 'Eckkamin', description: 'Eleganter Eckkamin mit Kacheln' },
        { id: 'oranier-polar-aqua', name: 'Polar W+ 2.0', brandId: 'oranier', price: 2877, power: '8 kW', efficiency: 'A+', style: 'Wasserführend', description: 'Wasserführend mit Speckstein' },
        { id: 'oranier-arena', name: 'Arena Aqua', brandId: 'oranier', price: 3999, power: '10 kW', efficiency: 'A+', style: 'Wasserführend', description: 'Leistungsstarker wasserführender Kaminofen' },
        { id: 'oranier-rota', name: 'Rota Top 2.0', brandId: 'oranier', price: 2499, power: '5 kW', efficiency: 'A+', style: 'Drehbar', description: 'Drehbarer Kaminofen mit Backfach' },
        
        // OLSBERG - 4 Modelle
        { id: 'olsberg-palena', name: 'Palena Compact', brandId: 'olsberg', price: 1599, power: '5 kW', efficiency: 'A+', style: 'Kompakt', description: 'Raumluftunabhängiger Kaminofen' },
        { id: 'olsberg-tipas', name: 'Tipas Compact', brandId: 'olsberg', price: 1799, power: '5 kW', efficiency: 'A+', style: 'Modern', description: 'Moderner raumluftunabhängiger Ofen' },
        { id: 'olsberg-aracar', name: 'Aracar Compact', brandId: 'olsberg', price: 1999, power: '5 kW', efficiency: 'A+', style: 'Speicher', description: 'Speicherofen mit PowerBloc-System' },
        { id: 'olsberg-ipala', name: 'Ipala Compact', brandId: 'olsberg', price: 2199, power: '6 kW', efficiency: 'A+', style: 'Premium', description: 'Premium-Kaminofen mit Kalkstein' },
        
        // SPARTHERM - 4 Modelle
        { id: 'spartherm-senso', name: 'Senso L', brandId: 'spartherm', price: 4499, power: '8 kW', efficiency: 'A+', style: 'Designer', description: 'Designer-Kaminofen mit Drehfunktion' },
        { id: 'spartherm-cubo', name: 'Cubo L', brandId: 'spartherm', price: 3999, power: '7 kW', efficiency: 'A+', style: 'Würfel', description: 'Würfelförmiger Design-Kaminofen' },
        { id: 'spartherm-ambiente', name: 'Ambiente A7', brandId: 'spartherm', price: 4999, power: '7 kW', efficiency: 'A+', style: 'Premium', description: 'Premium-Kaminofen mit Ambiente-Licht' },
        { id: 'spartherm-passo', name: 'Passo L', brandId: 'spartherm', price: 3799, power: '6 kW', efficiency: 'A+', style: 'Schmal', description: 'Schlanker Designer-Kaminofen' },
        
        // AUSTROFLAMM - 4 Modelle
        { id: 'austroflamm-clou', name: 'Clou Compact', brandId: 'austroflamm', price: 3299, power: '6 kW', efficiency: 'A+', style: 'Kompakt', description: 'Österreichischer Premium-Ofen, kompakt' },
        { id: 'austroflamm-slim', name: 'Slim 2.0', brandId: 'austroflamm', price: 2899, power: '4 kW', efficiency: 'A+', style: 'Ultra-Schmal', description: 'Nur 32cm tief - der Schmalste' },
        { id: 'austroflamm-pi-ko', name: 'Pi-Ko', brandId: 'austroflamm', price: 3599, power: '5 kW', efficiency: 'A+', style: 'Designer', description: 'Preisgekröntes Design aus Österreich' },
        { id: 'austroflamm-bell', name: 'Bell', brandId: 'austroflamm', price: 3199, power: '6 kW', efficiency: 'A+', style: 'Rund', description: 'Runder Kaminofen mit 360° Sicht' },
        
        // EDILKAMIN - 4 Modelle
        { id: 'edilkamin-tally', name: 'Tally', brandId: 'edilkamin', price: 1899, power: '8 kW', efficiency: 'A+', style: 'Modern', description: 'Moderner italienischer Kaminofen' },
        { id: 'edilkamin-aris', name: 'Aris Up', brandId: 'edilkamin', price: 2299, power: '9 kW', efficiency: 'A+', style: 'Panorama', description: 'Panorama-Kaminofen mit Keramik' },
        { id: 'edilkamin-nara', name: 'Nara', brandId: 'edilkamin', price: 2499, power: '7 kW', efficiency: 'A+', style: 'Klassisch', description: 'Klassisch-eleganter Kaminofen' },
        { id: 'edilkamin-cherie', name: 'Cherie Up', brandId: 'edilkamin', price: 1699, power: '8 kW', efficiency: 'A+', style: 'Budget', description: 'Gutes Preis-Leistungs-Verhältnis' },
        
        // SCHMITZKER - 3 Modelle
        { id: 'schmitzker-classico', name: 'Classico', brandId: 'schmitzker', price: 2799, power: '8 kW', efficiency: 'A+', style: 'Klassisch', description: 'Klassischer deutscher Qualitätsofen' },
        { id: 'schmitzker-vision', name: 'Vision', brandId: 'schmitzker', price: 3299, power: '7 kW', efficiency: 'A+', style: 'Modern', description: 'Moderner Kaminofen mit Panoramascheibe' },
        { id: 'schmitzker-ambiente', name: 'Ambiente', brandId: 'schmitzker', price: 2999, power: '6 kW', efficiency: 'A+', style: 'Elegant', description: 'Eleganter Kaminofen made in Germany' }
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
