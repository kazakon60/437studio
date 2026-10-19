// =========================================================================
// PERFORMANCE MONITOR v2.0
// Real-time performance monitoring and optimization for 437 Studio
// =========================================================================

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            domComplexity: 0,
            renderTime: 0,
            memoryUsage: 0,
            animationFrames: 0,
            layoutCount: 0,
            firstContentfulPaint: null,
            largestContentfulPaint: null,
            cumulativeLayoutShift: 0,
            pageLoadTime: 0
        };
        
        this.observers = {
            dom: null,
            layout: null,
            performance: null
        };
        
        this.initialized = false;
        this.animationFrameId = null;
        this.startTime = Date.now();
        
        this.init();
    }
    
    init() {
        if (this.initialized) return;
        
        // Initialize core metrics
        this.metrics.pageLoadTime = performance.now() - this.startTime;
        
        // Monitor DOM complexity
        this.observeDomComplexity();
        
        // Monitor layout shifts
        this.observeLayoutShifts();
        
        // Monitor performance entries
        this.observePerformanceEntries();
        
        // Initialize FPS counter
        this.startFPSMonitor();
        
        // Apply performance optimizations
        this.applyOptimizations();
        
        this.initialized = true;
        this.log('Performance Monitor initialized', 'info');
    }
    
    observeDomComplexity() {
        const observer = new MutationObserver((mutations) => {
            let complexityChange = 0;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    complexityChange += mutation.addedNodes.length - mutation.removedNodes.length;
                }
                if (mutation.type === 'attributes') {
                    complexityChange += mutation.target.classList.length;
                }
            });
            
            this.metrics.domComplexity += Math.max(0, complexityChange);
            this.log(`DOM complexity change: +${complexityChange}, total: ${this.metrics.domComplexity}`, 'debug');
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeOldValue: false
        });
        
        this.observers.dom = observer;
    }
    
    observeLayoutShifts() {
        const observer = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                if (entry.entryType === 'layout-shift') {
                    this.metrics.cumulativeLayoutShift += entry.value;
                    this.metrics.layoutCount++;
                    
                    if (entry.value > 0.1) {
                        this.log(`Layout shift detected: ${entry.value}`, 'warn');
                    }
                }
            }
        });
        
        observer.observe('layout-shift');
        this.observers.layout = observer;
    }
    
    observePerformanceEntries() {
        const observer = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                if (entry.entryType === 'largest-contentful-paint') {
                    this.metrics.largestContentfulPaint = entry.startTime;
                }
                
                if (entry.entryType === 'first-contentful-paint') {
                    this.metrics.firstContentfulPaint = entry.startTime;
                }
                
                if (entry.duration > 16.67) { // Longer than 60fps
                    this.metrics.renderTime += entry.duration;
                    this.log(`Slow render detected: ${entry.duration}ms`, 'warn');
                }
            }
        });
        
        observer.observe('largest-contentful-paint');
        observer.observe('first-contentful-paint');
        observer.observe('long-task');
        this.observers.performance = observer;
    }
    
    startFPSMonitor() {
        let lastTime = performance.now();
        let fps = 0;
        let frameCount = 0;
        
        const measureFPS = (currentTime) => {
            frameCount++;
            
            if (currentTime >= lastTime + 1000) {
                fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                frameCount = 0;
                lastTime = currentTime;
                
                this.metrics.animationFrames = fps;
                
                // Log FPS drops below 30
                if (fps < 30) {
                    this.log(`Low FPS detected: ${fps}`, 'warn');
                } else if (fps < 60) {
                    this.log(`Moderate FPS: ${fps}`, 'debug');
                }
                
                // Throttle animations if FPS is low
                if (fps < 30) {
                    document.body.classList.add('reduce-animations');
                } else {
                    document.body.classList.remove('reduce-animations');
                }
            }
            
            this.animationFrameId = requestAnimationFrame(measureFPS);
        };
        
        this.animationFrameId = requestAnimationFrame(measureFPS);
    }
    
    applyOptimizations() {
        // Remove unused CSS classes
        this.removeUnusedStyles();
        
        // Optimize DOM elements
        this.optimizeDOMElements();
        
        // Setup lazy loading
        this.setupLazyLoading();
        
        // Add performance classes
        this.addPerformanceClasses();
        
        // Preload critical resources
        this.preloadCriticalResources();
    }
    
    removeUnusedStyles() {
        // Remove overly complex animations
        const style = document.createElement('style');
        style.id = 'performance-optimizations';
        style.textContent = `
            /* Optimized animations for performance */
            * {
                animation-duration: ${this.metrics.animationFrames < 30 ? '0.05s' : '0.1s'} !important;
                transition-duration: ${this.metrics.animationFrames < 30 ? '0.05s' : '0.1s'} !important;
            }
            
            /* Reduce transform overhead */
            .gpu-accelerated {
                transform: translateZ(0);
                will-change: transform;
                backface-visibility: hidden;
                perspective: 1000px;
            }
            
            /* Optimize scroll performance */
            .hide-scrollbar {
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
            
            .hide-scrollbar::-webkit-scrollbar {
                display: none;
            }
            
            /* Reduce box-shadow complexity */
            .tool-action-btn {
                box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important;
            }
            
            /* Optimize flex layouts */
            .cyber-comms-grid,
            .input-control-row {
                contain: layout style;
            }
            
            /* Performance mode classes */
            .performance-mode {
                --animation-duration: 0.05s;
                --transition-duration: 0.05s;
                --shadow-intensity: 0.5;
            }
            
            .performance-mode * {
                animation-duration: inherit !important;
                transition-duration: inherit !important;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    optimizeDOMElements() {
        // Optimize chat container
        const chatContainer = document.getElementById('chat-bubbles-container');
        if (chatContainer) {
            chatContainer.style.willChange = 'scroll-position';
            chatContainer.style.contain = 'strict';
        }
        
        // Optimize sidebar
        const sidebar = document.querySelector('.cyber-sidebar');
        if (sidebar) {
            sidebar.style.willChange = 'transform';
            sidebar.style.transform = 'translateZ(0)';
        }
        
        // Optimize images
        document.querySelectorAll('img').forEach(img => {
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
        });
    }
    
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
    
    addPerformanceClasses() {
        // Add performance class based on device capability
        const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
        
        if (isLowEndDevice) {
            document.body.classList.add('performance-mode');
        }
        
        // Add GPU acceleration class
        document.body.classList.add('gpu-accelerated');
    }
    
    preloadCriticalResources() {
        // Preload critical CSS
        const criticalCSS = document.createElement('link');
        criticalCSS.rel = 'preload';
        criticalCSS.as = 'style';
        criticalCSS.href = 'css/style.css';
        document.head.appendChild(criticalCSS);
        
        // Preload critical JavaScript
        const criticalJS = document.createElement('link');
        criticalJS.rel = 'preload';
        criticalJS.as = 'script';
        criticalJS.href = 'js/performance-monitor.js';
        document.head.appendChild(criticalJS);
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const style = level === 'warn' ? 'color: #ff9900' : (level === 'error' ? 'color: #ff0000' : 'color: #00ff00');
        
        console.log(
            `%c[PerformanceMonitor] ${timestamp}: ${message}`, 
            style,
            level
        );
        
        // Send to analytics if available
        if (typeof analytics !== 'undefined') {
            analytics.logPerformance(message, level);
        }
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            domComplexity: Math.max(0, this.metrics.domComplexity),
            memoryUsage: this.getMemoryUsage(),
            renderTime: this.metrics.renderTime,
            layoutCount: this.metrics.layoutCount,
            fps: this.metrics.animationFrames
        };
    }
    
    getMemoryUsage() {
        if ('performance' in window && 'memory' in performance) {
            return performance.memory.usedJSHeapSize / 1048576; // MB
        }
        return 0;
    }
    
    cleanup() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        Object.values(this.observers).forEach(observer => {
            if (observer) observer.disconnect();
        });
        
        this.initialized = false;
        this.log('Performance Monitor cleaned up', 'info');
    }
    
    // Public API for manual performance optimization
    optimizeForDevice() {
        const isSlowConnection = navigator.connection && 
            (navigator.connection.effectiveType === '4g' || navigator.connection.downlink < 1.5);
        
        if (isSlowConnection) {
            document.body.classList.add('performance-mode');
            this.log('Slow connection detected, enabling performance mode', 'info');
        }
    }
}

// Initialize performance monitor
const performanceMonitor = new PerformanceMonitor();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
}

// Make available globally
window.performanceMonitor = performanceMonitor;
