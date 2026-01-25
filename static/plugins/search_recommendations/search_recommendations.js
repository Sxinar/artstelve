/**
 * Search Recommendations Plugin
 * Provides intelligent search recommendations based on query analysis
 */

(function() {
    'use strict';

    const SearchRecommendations = {
        recommendations: [],
        currentQuery: '',
        
        // Popular search categories and suggestions
        categories: {
            'programming': ['javascript tutorial', 'python basics', 'react hooks', 'node.js guide', 'css tricks'],
            'technology': ['latest tech news', 'ai developments', 'cloud computing', 'cybersecurity tips', 'web3 explained'],
            'learning': ['online courses', 'free tutorials', 'coding bootcamp', 'certification programs', 'skill development'],
            'tools': ['best code editor', 'version control', 'project management', 'api testing', 'devops tools'],
            'general': ['how to', 'what is', 'best practices', 'comparison', 'guide']
        },

        init() {
            this.setupRecommendationEngine();
            this.addRecommendationUI();
        },

        setupRecommendationEngine() {
            // Listen to search input
            setTimeout(() => {
                const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i], input[placeholder*="ara" i]');
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        this.currentQuery = e.target.value.toLowerCase().trim();
                        if (this.currentQuery.length > 0) {
                            this.generateRecommendations(this.currentQuery);
                        } else {
                            this.showPopularSearches();
                        }
                    });

                    searchInput.addEventListener('focus', () => {
                        if (!this.currentQuery) {
                            this.showPopularSearches();
                        }
                    });
                }
            }, 1000);
        },

        generateRecommendations(query) {
            this.recommendations = [];
            
            // Analyze query to determine category
            const category = this.detectCategory(query);
            
            // Get category-based recommendations
            if (category && this.categories[category]) {
                this.recommendations = this.categories[category]
                    .filter(rec => rec.toLowerCase().includes(query) || query.includes(rec.split(' ')[0]))
                    .slice(0, 5);
            }

            // Add history-based recommendations
            const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
            const historyMatches = history
                .filter(h => h.query && h.query.toLowerCase().includes(query))
                .map(h => h.query)
                .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
                .slice(0, 3);
            
            this.recommendations = [...new Set([...this.recommendations, ...historyMatches])].slice(0, 8);

            // Add related searches
            const related = this.generateRelatedSearches(query);
            this.recommendations = [...new Set([...this.recommendations, ...related])].slice(0, 10);

            this.displayRecommendations();
        },

        detectCategory(query) {
            const keywords = {
                'programming': ['code', 'programming', 'developer', 'coding', 'javascript', 'python', 'react', 'vue', 'angular'],
                'technology': ['tech', 'technology', 'ai', 'machine learning', 'cloud', 'cyber', 'blockchain'],
                'learning': ['learn', 'tutorial', 'course', 'education', 'study', 'training', 'certificate'],
                'tools': ['tool', 'software', 'app', 'platform', 'service', 'framework', 'library'],
                'general': ['how', 'what', 'why', 'when', 'where', 'best', 'top', 'compare']
            };

            for (const [category, terms] of Object.entries(keywords)) {
                if (terms.some(term => query.includes(term))) {
                    return category;
                }
            }
            return null;
        },

        generateRelatedSearches(query) {
            const words = query.split(' ');
            const related = [];
            
            // Add variations
            if (words.length > 1) {
                related.push(words.slice(1).join(' ') + ' ' + words[0]);
            }
            
            // Add common prefixes/suffixes
            const prefixes = ['best', 'top', 'how to', 'guide to', 'learn'];
            const suffixes = ['tutorial', 'guide', 'examples', 'tips', 'tricks'];
            
            prefixes.forEach(prefix => {
                if (!query.startsWith(prefix)) {
                    related.push(`${prefix} ${query}`);
                }
            });
            
            suffixes.forEach(suffix => {
                if (!query.endsWith(suffix)) {
                    related.push(`${query} ${suffix}`);
                }
            });

            return related.slice(0, 5);
        },

        showPopularSearches() {
            const popular = [
                'javascript tutorial',
                'python programming',
                'web development',
                'react hooks',
                'node.js guide',
                'css tricks',
                'api documentation',
                'machine learning basics'
            ];
            
            this.recommendations = popular;
            this.displayRecommendations();
        },

        addRecommendationUI() {
            setTimeout(() => {
                const searchContainer = document.querySelector('.search-container, form[action*="search"], [class*="search"]');
                if (searchContainer) {
                    const recBox = document.createElement('div');
                    recBox.id = 'search-recommendations-box';
                    recBox.style.cssText = `
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        margin-top: 5px;
                        max-height: 400px;
                        overflow-y: auto;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                        z-index: 10000;
                        display: none;
                    `;
                    
                    const searchInput = document.querySelector('input[type="search"]');
                    if (searchInput && searchInput.parentElement) {
                        searchInput.parentElement.style.position = 'relative';
                        searchInput.parentElement.appendChild(recBox);
                    }

                    // Close on outside click
                    document.addEventListener('click', (e) => {
                        if (!recBox.contains(e.target) && e.target !== searchInput) {
                            recBox.style.display = 'none';
                        }
                    });
                }
            }, 1500);
        },

        displayRecommendations() {
            const box = document.getElementById('search-recommendations-box');
            if (!box) return;

            if (this.recommendations.length === 0) {
                box.style.display = 'none';
                return;
            }

            box.innerHTML = `
                <div style="padding: 12px; background: #f5f5f5; font-weight: bold; border-bottom: 1px solid #ddd; font-size: 14px;">
                    💡 Search Recommendations
                </div>
                ${this.recommendations.map((rec, index) => `
                    <div class="recommendation-item" 
                         style="padding: 12px; cursor: pointer; border-bottom: 1px solid #eee; display: flex; align-items: center; transition: background 0.2s;"
                         onmouseover="this.style.background='#f0f7ff'"
                         onmouseout="this.style.background='white'"
                         onclick="SearchRecommendations.selectRecommendation('${rec.replace(/'/g, "\\'")}')">
                        <span style="margin-right: 10px; color: #4a9eff;">🔍</span>
                        <span style="flex: 1;">${rec}</span>
                        <span style="color: #999; font-size: 12px;">Press Enter</span>
                    </div>
                `).join('')}
            `;
            
            box.style.display = 'block';
        },

        selectRecommendation(recommendation) {
            const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]');
            if (searchInput) {
                searchInput.value = recommendation;
                searchInput.focus();
                
                // Trigger search
                const form = searchInput.closest('form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                } else {
                    // Fallback: trigger input event to update UI
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            
            const box = document.getElementById('search-recommendations-box');
            if (box) box.style.display = 'none';
        }
    };

    // Make it global for onclick handlers
    window.SearchRecommendations = SearchRecommendations;

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SearchRecommendations.init());
    } else {
        SearchRecommendations.init();
    }
})();
