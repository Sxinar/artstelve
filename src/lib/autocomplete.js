// Otomatik Tamamlama Sistemi
class AutoCompleteSystem {
    constructor(config = {}) {
        this.suggestions = [];
        this.config = {
            maxSuggestions: 10,
            minChars: 2,
            debounceMs: 300,
            enableHistory: true,
            enablePopular: true,
            ...config
        };
        this.debounceTimer = null;
        this.currentIndex = -1;

        this.loadSuggestions();
    }

    // Önerileri yükle
    async loadSuggestions() {
        try {
            // Arama geçmişini yükle
            if (this.config.enableHistory) {
                const history = this.getSearchHistory();
                this.addSuggestions(history.map(h => ({
                    text: h.query,
                    type: 'history',
                    timestamp: h.timestamp
                })));
            }
        } catch (error) {
            console.error('Öneriler yüklenirken hata:', error);
        }
    }

    // Arama geçmişini al
    getSearchHistory() {
        try {
            const history = localStorage.getItem('artado_search_history');
            return history ? JSON.parse(history) : [];
        } catch {
            return [];
        }
    }

    // Öneri ekle
    addSuggestions(newSuggestions) {
        newSuggestions.forEach(suggestion => {
            // Mevcut öneriyi kontrol et
            const existing = this.suggestions.find(s => 
                s.text.toLowerCase() === suggestion.text.toLowerCase()
            );
            
            if (existing) {
                // Mevcutsa sayıyı güncelle
                if (suggestion.count && existing.count) {
                    existing.count = Math.max(existing.count, suggestion.count);
                }
            } else {
                // Yoksa ekle
                this.suggestions.push(suggestion);
            }
        });

        // Önerileri sırala (popülerlik ve zamana göre)
        this.suggestions.sort((a, b) => {
            if (a.type === 'popular' && b.type !== 'popular') return -1;
            if (a.type !== 'popular' && b.type === 'popular') return 1;
            
            const aScore = (a.count || 0) * 1000 + (a.timestamp ? new Date(a.timestamp).getTime() : 0);
            const bScore = (b.count || 0) * 1000 + (b.timestamp ? new Date(b.timestamp).getTime() : 0);
            
            return bScore - aScore;
        });
    }

    // Önerileri getir
    getSuggestions(query) {
        if (query.length < this.config.minChars) {
            return [];
        }

        const queryLower = query.toLowerCase();
        const filtered = this.suggestions.filter(suggestion =>
            suggestion.text.toLowerCase().includes(queryLower)
        );

        return filtered.slice(0, this.config.maxSuggestions);
    }

    // Arama yapıldığında kaydet
    saveSearch(query) {
        if (!query.trim()) return;

        const history = this.getSearchHistory();
        const newEntry = {
            query: query.trim(),
            timestamp: new Date().toISOString()
        };

        // Aynı sorguyu kaldır
        const filtered = history.filter(h => h.query !== newEntry.query);
        
        // Başa ekle
        filtered.unshift(newEntry);
        
        // Maksimum 100 kayıt tut
        const limited = filtered.slice(0, 100);
        
        localStorage.setItem('artado_search_history', JSON.stringify(limited));

        // Önerilere de ekle
        this.addSuggestions([{
            text: newEntry.query,
            type: 'history',
            timestamp: newEntry.timestamp
        }]);
    }

    // Mevcut önerileri al (UI için)
    getCurrentSuggestions() {
        const input = document.getElementById('searchInput');
        if (!input) return [];
        
        return this.getSuggestions(input.value);
    }

    // Klavye navigasyonu
    handleKeydown(event) {
        const suggestions = this.getCurrentSuggestions();
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.currentIndex = Math.min(this.currentIndex + 1, suggestions.length - 1);
                this.highlightSuggestion();
                return true;
                
            case 'ArrowUp':
                event.preventDefault();
                this.currentIndex = Math.max(this.currentIndex - 1, -1);
                this.highlightSuggestion();
                return true;
                
            case 'Enter':
                if (this.currentIndex >= 0) {
                    event.preventDefault();
                    const selected = suggestions[this.currentIndex];
                    if (selected) {
                        this.applySuggestion(selected);
                    }
                    return true;
                }
                break;
                
            case 'Escape':
                this.hideSuggestions();
                this.currentIndex = -1;
                return true;
        }
        
        return false;
    }

    // Öneriyi vurgula
    highlightSuggestion() {
        const items = document.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === this.currentIndex) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
    }

    // Öneriyi uygula
    applySuggestion(suggestion) {
        const input = document.getElementById('searchInput');
        if (input) {
            input.value = suggestion.text;
            this.hideSuggestions();
            this.currentIndex = -1;
            
            // Arama yap
            this.performSearch(suggestion.text);
        }
    }

    // Arama yap
    performSearch(query) {
        this.saveSearch(query);
        
        // Arama sayfasına yönlendir
        const searchUrl = `/search?i=${encodeURIComponent(query)}`;
        window.location.href = searchUrl;
    }

    // Önerileri göster
    showSuggestions() {
        const suggestions = this.getCurrentSuggestions();
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        const container = this.createSuggestionsContainer();
        container.innerHTML = '';

        suggestions.forEach((suggestion, index) => {
            const item = this.createSuggestionItem(suggestion, index);
            container.appendChild(item);
        });

        container.style.display = 'block';
        this.currentIndex = -1;
    }

    // Önerileri gizle
    hideSuggestions() {
        const container = document.getElementById('suggestions-container');
        if (container) {
            container.style.display = 'none';
        }
        this.currentIndex = -1;
    }

    // Öneri container'ı oluştur
    createSuggestionsContainer() {
        let container = document.getElementById('suggestions-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'suggestions-container';
            container.className = 'suggestions-container';
            
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                searchContainer.appendChild(container);
            } else {
                document.body.appendChild(container);
            }
        }
        return container;
    }

    // Öneri öğesi oluştur
    createSuggestionItem(suggestion, index) {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.dataset.index = index;

        const icon = this.getSuggestionIcon(suggestion.type);
        const text = suggestion.text;
        const meta = this.getSuggestionMeta(suggestion);

        item.innerHTML = `
            <div class="suggestion-icon">${icon}</div>
            <div class="suggestion-text">${this.highlightMatch(text)}</div>
            <div class="suggestion-meta">${meta}</div>
        `;

        item.addEventListener('click', () => {
            this.applySuggestion(suggestion);
        });

        item.addEventListener('mouseenter', () => {
            this.currentIndex = index;
            this.highlightSuggestion();
        });

        return item;
    }

    // Öneri ikonu
    getSuggestionIcon(type) {
        switch (type) {
            case 'history':
                return '<i class="fas fa-history"></i>';
            case 'popular':
                return '<i class="fas fa-fire"></i>';
            default:
                return '<i class="fas fa-search"></i>';
        }
    }

    // Öneri meta bilgisi
    getSuggestionMeta(suggestion) {
        if (suggestion.count) {
            return `${suggestion.count} arama`;
        }
        if (suggestion.timestamp) {
            const date = new Date(suggestion.timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 60) {
                return `${diffMins} dk önce`;
            } else if (diffMins < 1440) {
                return `${Math.floor(diffMins / 60)} saat önce`;
            } else {
                return `${Math.floor(diffMins / 1440)} gün önce`;
            }
        }
        return '';
    }

    // Eşleşen metni vurgula
    highlightMatch(text) {
        const input = document.getElementById('searchInput');
        if (!input) return text;

        const query = input.value.toLowerCase();
        if (query.length < this.config.minChars) return text;

        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // Input olayını yönet
    handleInput() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.showSuggestions();
        }, this.config.debounceMs);
    }

    // Sistemi temizle
    destroy() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.hideSuggestions();
    }
}

// Export for Svelte usage
export { AutoCompleteSystem };