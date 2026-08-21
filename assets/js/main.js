// Global authenticated fetch wrapper
window.fetchWithAuth = async function(url, options = {}) {
    let token = localStorage.getItem('accessToken');
    
    // Ensure headers exist
    if (!options.headers) {
        options.headers = {};
    }
    
    // Add auth header if we have a token and it's not already set
    if (token && !options.headers['Authorization']) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    let response = await fetch(url, options);
    
    // If 401 Unauthorized, try to refresh token
    if (response.status === 401) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            try {
                const refreshResponse = await fetch('http://127.0.0.1:8000/api/v1/auth/refresh', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });
                
                if (refreshResponse.ok) {
                    const data = await refreshResponse.json();
                    localStorage.setItem('accessToken', data.access_token);
                    if (data.refresh_token) {
                        localStorage.setItem('refreshToken', data.refresh_token);
                    }
                    
                    // Retry original request with new token
                    options.headers['Authorization'] = `Bearer ${data.access_token}`;
                    response = await fetch(url, options);
                } else {
                    // Refresh failed, logout
                    throw new Error('Refresh failed');
                }
            } catch (err) {
                console.error('Token refresh failed', err);
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userRole');
                window.location.href = 'login.html';
            }
        } else {
            // No refresh token, logout
            localStorage.removeItem('accessToken');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userRole');
            window.location.href = 'login.html';
        }
    }
    
    return response;
};

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Theme Toggle Logic ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // Initialize theme
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if(themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            if (theme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            }
        });
    }

    // --- Cart & Checkout Quantity Logic ---
    const quantityContainers = document.querySelectorAll('.input-group');
    
    quantityContainers.forEach(container => {
        const minusBtn = container.querySelector('button:first-child');
        const plusBtn = container.querySelector('button:last-child');
        const inputField = container.querySelector('input');
        
        if(minusBtn && plusBtn && inputField) {
            // Minus Button
            minusBtn.addEventListener('click', () => {
                let currentValue = parseInt(inputField.value);
                if (currentValue > 1) {
                    inputField.value = currentValue - 1;
                    updateCartTotal();
                }
            });

            // Plus Button
            plusBtn.addEventListener('click', () => {
                let currentValue = parseInt(inputField.value);
                if (currentValue < 99) { // Max limit
                    inputField.value = currentValue + 1;
                    updateCartTotal();
                }
            });
            
            // Manual input
            inputField.addEventListener('change', () => {
                if(parseInt(inputField.value) < 1 || isNaN(inputField.value)) {
                    inputField.value = 1;
                }
                updateCartTotal();
            });
        }
    });

    // --- Remove Item Logic ---
    const removeButtons = document.querySelectorAll('.text-danger');
    
    removeButtons.forEach(btn => {
        // Exclude wishlist top level buttons or generic danger text
        if(btn.tagName.toLowerCase() === 'button' || btn.classList.contains('btn-wishlist')) {
            btn.addEventListener('click', function(e) {
                // If it's a remove button in cart (usually nested in a row)
                const cartRow = this.closest('.row.align-items-center');
                if (cartRow) {
                    cartRow.style.opacity = '0';
                    setTimeout(() => {
                        cartRow.remove();
                        updateCartTotal();
                        checkEmptyCart(this.closest('.card-body'));
                        updateBadge('a[href="cart.html"] .badge', -1); // Decrement cart badge
                    }, 300);
                    return;
                }
                
                // If it's a wishlist item removal
                const productCard = this.closest('.col');
                if(productCard && this.classList.contains('btn-wishlist')) {
                    productCard.style.opacity = '0';
                    setTimeout(() => {
                        productCard.remove();
                        updateBadge('a[href="wishlist.html"] .badge', -1); // Decrement wishlist badge
                    }, 300);
                }
            });
        }
    });
    
    // --- Badge Counting & Interactive Logic ---
    function updateBadge(selector, change) {
        const badges = document.querySelectorAll(selector);
        badges.forEach(badge => {
            let current = parseInt(badge.textContent) || 0;
            let newVal = current + change;
            if (newVal < 0) newVal = 0;
            badge.textContent = newVal;
            
            // Pulse animation
            badge.style.transform = 'scale(1.5)';
            badge.style.transition = 'transform 0.2s';
            setTimeout(() => {
                badge.style.transform = 'scale(1)';
            }, 200);
        });
    }

    // Add to cart buttons (prevent default if needed, increment badge, show success state)
    const addToCartBtns = document.querySelectorAll('.btn-add-cart, .btn-primary-custom');
    addToCartBtns.forEach(btn => {
        // Only target buttons that literally add to cart, not checkout or login
        if(btn.textContent.toLowerCase().includes('add to cart')) {
            btn.addEventListener('click', (e) => {
                // If it's an anchor link, we don't necessarily want to jump to the cart immediately for a "real-time" feel, but since it's a static site, let's just let it navigate OR stop it for demo.
                // We'll prevent default so they can see the realtime count, except if they really want to go.
                e.preventDefault(); 
                
                updateBadge('a[href="cart.html"] .badge', 1);
                
                // Visual feedback
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check me-2"></i>Added';
                btn.style.backgroundColor = 'var(--success-color)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--success-color)';
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.backgroundColor = '';
                    btn.style.color = '';
                    btn.style.borderColor = '';
                }, 1500);
            });
        }
    });

    // Wishlist buttons (Add/Remove toggle on product grids)
    const wishlistBtns = document.querySelectorAll('.btn-wishlist');
    wishlistBtns.forEach(btn => {
        // Exclude the ones on wishlist page (they have text-danger or border-danger initially)
        if(!btn.classList.contains('text-danger')) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const icon = btn.querySelector('i');
                if (icon.classList.contains('far')) {
                    // Add to wishlist
                    icon.classList.replace('far', 'fas');
                    icon.classList.add('text-danger');
                    updateBadge('a[href="wishlist.html"] .badge', 1);
                } else {
                    // Remove from wishlist
                    icon.classList.replace('fas', 'far');
                    icon.classList.remove('text-danger');
                    updateBadge('a[href="wishlist.html"] .badge', -1);
                }
            });
        }
    });

    // --- Helper function for Cart ---
    function checkEmptyCart(cardBody) {
        if(cardBody && cardBody.querySelectorAll('.row').length === 0) {
            // Remove the whole vendor block if empty
            const vendorCard = cardBody.closest('.card');
            if(vendorCard) {
                vendorCard.remove();
            }
        }
    }
    
    function updateCartTotal() {
        // Check if we are on the cart page by verifying order summary exists
        const summaryTotalEl = document.getElementById('summary-total');
        
        if (summaryTotalEl) {
            const itemRows = document.querySelectorAll('.card-body .row.align-items-center');
            let subtotal = 0;
            let totalItems = 0;

            itemRows.forEach(row => {
                if (row.style.opacity === '0') return; // Skip items being removed

                const qtyInput = row.querySelector('input.text-center');
                const priceEl = row.querySelector('.fw-bold.text-primary');
                
                if (qtyInput && priceEl) {
                    const qty = parseInt(qtyInput.value) || 1;
                    totalItems += qty;
                    
                    // Save original unit price if not already saved
                    if (!priceEl.hasAttribute('data-unit-price')) {
                        const rawPrice = parseInt(priceEl.textContent.replace(/[^0-9]/g, ''));
                        priceEl.setAttribute('data-unit-price', rawPrice);
                    }
                    
                    const unitPrice = parseInt(priceEl.getAttribute('data-unit-price'));
                    const itemTotal = unitPrice * qty;
                    subtotal += itemTotal;
                    
                    // Update item price display visually to reflect quantity
                    priceEl.textContent = '৳ ' + itemTotal.toLocaleString();
                }
            });

            const summaryItemsEl = document.getElementById('summary-items');
            if (summaryItemsEl) summaryItemsEl.textContent = `Subtotal (${totalItems} items)`;
            
            const summarySubtotalEl = document.getElementById('summary-subtotal');
            if (summarySubtotalEl) summarySubtotalEl.textContent = '৳ ' + subtotal.toLocaleString();
            
            // Tax parsing or just static
            const summaryTaxEl = document.getElementById('summary-tax');
            const tax = summaryTaxEl ? parseInt(summaryTaxEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0;
            
            // Shipping parsing or just static
            const summaryShippingEl = document.getElementById('summary-shipping');
            let shipping = 0;
            if (summaryShippingEl && summaryShippingEl.textContent.trim() !== 'Free') {
                shipping = parseInt(summaryShippingEl.textContent.replace(/[^0-9]/g, '')) || 0;
            }

            const total = subtotal > 0 ? subtotal + tax + shipping : 0;
            summaryTotalEl.textContent = '৳ ' + total.toLocaleString();
            
            // Also update the cart badge if total items changed
            updateBadge('a[href="cart.html"] .badge', totalItems - (parseInt(document.querySelector('a[href="cart.html"] .badge')?.textContent) || 0));
        }

        // Pulse effect for visual feedback
        const totalElements = document.querySelectorAll('.fw-bold.text-primary, .fs-5.text-primary, .fs-4.text-primary');
        totalElements.forEach(el => {
            el.style.transform = 'scale(1.05)';
            el.style.transition = 'transform 0.2s';
            setTimeout(() => {
                el.style.transform = 'scale(1)';
            }, 200);
        });
    }

    // --- Products Page Dynamic Loading ---
    if (window.location.pathname.endsWith('products.html')) {
        const productGrid = document.getElementById('product-grid');
        const categoriesList = document.getElementById('categories-filter-list');
        const countText = document.querySelector('.col-lg-9 .text-muted');
        const breadcrumbCategory = document.querySelector('.breadcrumb-item.active');
        const urlParams = new URLSearchParams(window.location.search);
        let currentCategorySlug = urlParams.get('category');
        let currentCategoryId = null;

        async function loadProductsPage() {
            if (productGrid) {
                productGrid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';
            }
            if (categoriesList) {
                categoriesList.innerHTML = '<div class="text-center py-2"><span class="spinner-border spinner-border-sm text-primary"></span></div>';
            }
            try {
                // Fetch Categories
                const catRes = await fetch('http://127.0.0.1:8000/api/v1/categories/', { headers: { 'Accept': 'application/json' } });
                if (catRes.ok) {
                    const catData = await catRes.json();
                    if (catData.success && categoriesList) {
                        categoriesList.innerHTML = '';
                        catData.data.forEach((cat, index) => {
                            // Determine if this is the active category based on slug
                            const isChecked = currentCategorySlug && currentCategorySlug.toLowerCase() === cat.slug.toLowerCase();
                            if (isChecked) {
                                currentCategoryId = cat.id;
                                if (breadcrumbCategory) breadcrumbCategory.textContent = cat.name;
                            }
                            
                            categoriesList.innerHTML += `
                            <li class="mb-2">
                                <div class="form-check">
                                    <input class="form-check-input category-filter-checkbox" type="checkbox" id="cat_${cat.id}" value="${cat.id}" ${isChecked ? 'checked' : ''} onchange="filterByCategory('${cat.id}', '${cat.slug}', this)">
                                    <label class="form-check-label" for="cat_${cat.id}">${cat.name}</label>
                                </div>
                            </li>`;
                        });
                    }
                }

                // Fetch Products
                let prodUrl = 'http://127.0.0.1:8000/api/v1/products/';
                if (currentCategoryId) {
                    prodUrl += `?category_id=${currentCategoryId}`;
                }
                const prodRes = await fetch(prodUrl, { headers: { 'Accept': 'application/json' } });
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    if (prodData.success && productGrid) {
                        productGrid.innerHTML = '';
                        const products = prodData.data;
                        
                        if (countText) countText.textContent = `Showing 1-${products.length} of ${products.length} products`;
                        
                        if (products.length === 0) {
                            productGrid.innerHTML = '<div class="col-12 text-center py-5"><h4>No products found</h4><p class="text-muted">Try clearing your filters or search for something else.</p></div>';
                        } else {
                            products.forEach(prod => {
                                productGrid.innerHTML += createProductCardHtml(prod, null);
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading products page:', error);
                if (productGrid) productGrid.innerHTML = '<div class="col-12 text-center py-5 text-danger"><h4>Error loading products</h4></div>';
            }
        }

        window.filterByCategory = function(catId, catSlug, checkbox) {
            // Uncheck others to behave like radio or allow multiple (for now behave like radio)
            document.querySelectorAll('.category-filter-checkbox').forEach(cb => {
                if (cb !== checkbox) cb.checked = false;
            });
            
            if (checkbox.checked) {
                window.location.href = `products.html?category=${catSlug}`;
            } else {
                window.location.href = `products.html`;
            }
        };

        loadProductsPage();
    }


    // --- Admin Authentication Simulation ---
    // Check if the user is logged in as an admin
    const userRole = localStorage.getItem('userRole');
    const adminBtn = document.getElementById('adminDashboardBtn');
    
    // If admin is logged in and the button exists on this page, show it
    if (userRole === 'admin' && adminBtn) {
        adminBtn.classList.remove('d-none');
    }

    // --- Fetch Home Page Data dynamically ---
    async function fetchHomeData() {
        const catContainer = document.getElementById('home-categories-container');
        const flashContainer = document.getElementById('home-flash-sale-container');
        const trendingContainer = document.getElementById('home-trending-container');
        const mensContainer = document.getElementById('home-mens-fashion-container');

        if (!catContainer && !flashContainer && !trendingContainer && !mensContainer) return;

        if (catContainer) {
            catContainer.innerHTML = '<div class="col-12 text-center py-4"><span class="spinner-border text-primary"></span></div>';
        }
        if (flashContainer) {
            flashContainer.innerHTML = '<div class="col-12 text-center py-5"><span class="spinner-border text-primary"></span></div>';
        }
        if (trendingContainer) {
            trendingContainer.innerHTML = '<div class="col-12 text-center py-5"><span class="spinner-border text-primary"></span></div>';
        }

        try {
            if (catContainer) {
                const catRes = await fetch('http://127.0.0.1:8000/api/v1/categories/', { headers: { 'Accept': 'application/json' } });
                const catData = await catRes.json();
                if (catRes.ok && catData.success) {
                    catContainer.innerHTML = '';
                    const categories = catData.data.slice(0, 6);
                    categories.forEach(cat => {
                        const iconHtml = cat.image ? `<img src="${cat.image}" width="40" height="40" style="object-fit:cover; border-radius:50%;">` : `<div class="category-icon"><i class="fas fa-box"></i></div>`;
                        catContainer.innerHTML += `
                        <div class="col">
                            <div class="category-card" onclick="window.location.href='products.html?category=${cat.slug}'">
                                ${iconHtml.includes('<img') ? `<div class="category-icon p-0 overflow-hidden" style="border:none;">${iconHtml}</div>` : iconHtml}
                                <h3 class="category-title">${cat.name}</h3>
                            </div>
                        </div>`;
                    });
                }
            }

            if (flashContainer || trendingContainer || mensContainer) {
                const prodRes = await fetch('http://127.0.0.1:8000/api/v1/products/', { headers: { 'Accept': 'application/json' } });
                const prodData = await prodRes.json();
                if (prodRes.ok && prodData.success) {
                    const products = prodData.data;
                    
                    if (flashContainer) {
                        flashContainer.innerHTML = '';
                        const flashProducts = products.slice(0, 4);
                        flashProducts.forEach(prod => {
                            flashContainer.innerHTML += createProductCardHtml(prod, '-20%');
                        });
                    }

                    if (trendingContainer) {
                        trendingContainer.innerHTML = '';
                        const trendingProducts = products.slice(4, 8);
                        trendingProducts.forEach(prod => {
                            trendingContainer.innerHTML += createProductCardHtml(prod, null);
                        });
                    }

                    if (mensContainer) {
                        mensContainer.innerHTML = '';
                        const mensProducts = products.slice(8, 12);
                        mensProducts.forEach(prod => {
                            mensContainer.innerHTML += createProductCardHtml(prod, null);
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching home data:', error);
        }
    }

    function createProductCardHtml(product, discountBadge) {
        const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/200';
        const vendorName = product.vendor ? product.vendor.shop_name : 'Unknown Vendor';
        const oldPriceHtml = discountBadge ? `<div class="product-price-old">৳ ${Math.floor(product.price * 1.2)}</div>` : '';
        const badgeHtml = discountBadge ? `<span class="badge-discount">${discountBadge}</span>` : '';
        
        return `
        <div class="col">
            <div class="product-card h-100">
                ${badgeHtml}
                <button class="btn-wishlist" onclick="addToWishlist('${product.id}', this)"><i class="far fa-heart"></i></button>
                <a href="product-details.html?id=${product.id}" class="text-decoration-none">
                    <div class="product-image-wrap">
                        <img src="${imgUrl}" alt="Product" class="product-image" style="height: 200px; object-fit: cover; width: 100%;">
                    </div>
                </a>
                <div class="product-info">
                    <div class="product-brand">${product.category ? product.category.name : 'General'}</div>
                    <a href="product-details.html?id=${product.id}" class="text-decoration-none"><h3 class="product-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name}</h3></a>
                    <div class="product-rating">
                        <i class="fas fa-star text-warning"></i><i class="fas fa-star text-warning"></i><i class="fas fa-star text-warning"></i><i class="fas fa-star text-warning"></i><i class="fas fa-star-half-alt text-warning"></i>
                        <span class="text-muted ms-1">(12)</span>
                    </div>
                    <div class="d-flex align-items-center mb-2 mt-2">
                        <div class="product-price fs-5 fw-bold text-primary">৳ ${product.price}</div>
                        ${oldPriceHtml}
                    </div>
                    <div class="vendor-name text-muted small"><i class="fas fa-store me-1"></i> ${vendorName}</div>
                    <button class="btn btn-add-cart w-100 mt-3" onclick="addToCart('${product.id}', event)"><i class="fas fa-shopping-cart me-2"></i>Add to Cart</button>
                </div>
            </div>
        </div>`;
    }

    // Call fetchHomeData if on index.html
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
        fetchHomeData();
    }

    // --- API Integrations for Cart and Wishlist ---
    window.addToCart = async function(productId, event = null, quantity = 1) {
        if (event) event.preventDefault();
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!token || !userId) {
            window.location.href = 'login.html';
            return;
        }
        
        let btn = null;
        let originalText = '';
        if (event) {
            btn = event.currentTarget;
            originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Adding...';
            btn.disabled = true;
        }

        try {
            const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/cart/${userId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ product_id: productId, quantity: quantity })
            });
            const data = await response.json();
            
            if (response.ok && data.success) {
                if (window.updateHeaderBadges) window.updateHeaderBadges();
                const cartBadge = document.querySelector('a[href="cart.html"] .badge');
                if (cartBadge) {
                    cartBadge.style.transform = 'scale(1.5)';
                    setTimeout(() => cartBadge.style.transform = 'scale(1)', 200);
                }
                
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-check me-2"></i>Added';
                    btn.style.backgroundColor = 'var(--success-color)';
                    btn.style.color = 'white';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.backgroundColor = '';
                        btn.style.color = '';
                        btn.disabled = false;
                    }, 2000);
                } else {
                    alert('Item added to cart!');
                }
            } else {
                if (btn) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
                alert(data.message || 'Failed to add to cart');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            alert('Network error');
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    };

    window.addToWishlist = async function(productId, btnElement) {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!token || !userId) {
            window.location.href = 'login.html';
            return;
        }
        
        const icon = btnElement.querySelector('i');
        const isCurrentlyWishlisted = icon.classList.contains('fas');
        
        try {
            if (!isCurrentlyWishlisted) {
                // Add to wishlist
                const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/wishlist/${userId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ product_id: productId })
                });
                if (response.ok) {
                    icon.classList.replace('far', 'fas');
                    icon.classList.add('text-danger');
                    if (window.updateHeaderBadges) window.updateHeaderBadges();
                }
            } else {
                // Remove from wishlist
                const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/wishlist/${userId}/items/${productId}`, {
                    method: 'DELETE',
                    headers: { 'Accept': 'application/json' }
                });
                if (response.ok) {
                    icon.classList.replace('fas', 'far');
                    icon.classList.remove('text-danger');
                    if (window.updateHeaderBadges) window.updateHeaderBadges();
                }
            }
        } catch (error) {
            console.error('Error toggling wishlist:', error);
        }
    };

    // --- Cart Page Dynamic Loading ---
    async function loadCartPage() {
        const cartContainer = document.getElementById('cart-items-container');
        if (!cartContainer || !window.location.pathname.endsWith('cart.html')) return;

        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!token || !userId) {
            cartContainer.innerHTML = '<div class="alert alert-warning">Please <a href="login.html">login</a> to view your cart.</div>';
            return;
        }

        cartContainer.innerHTML = '<div class="text-center py-5"><span class="spinner-border text-primary"></span></div>';

        try {
            const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/cart/${userId}`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();
            
            if (response.ok && data.success && data.data) {
                const cart = data.data;
                const items = cart.items || [];
                
                if (items.length === 0) {
                    cartContainer.innerHTML = '<div class="text-center py-5"><h4>Your cart is empty</h4><a href="products.html" class="btn btn-primary mt-3">Start Shopping</a></div>';
                    document.getElementById('summary-subtotal').textContent = '৳ 0';
                    document.getElementById('summary-tax').textContent = '৳ 0';
                    document.getElementById('summary-total').textContent = '৳ 0';
                    document.getElementById('summary-items').textContent = `Subtotal (0 items)`;
                    return;
                }

                cartContainer.innerHTML = '';
                
                // Group by vendor (assuming products have vendor ID, but we just list them for now in a single card if no vendor info)
                const vendorMap = {};
                items.forEach(item => {
                    const vName = (item.product && item.product.vendor) ? item.product.vendor.shop_name : 'Marketplace Seller';
                    if (!vendorMap[vName]) vendorMap[vName] = [];
                    vendorMap[vName].push(item);
                });

                for (const [vendorName, vendorItems] of Object.entries(vendorMap)) {
                    let itemsHtml = '';
                    vendorItems.forEach(item => {
                        const product = item.product || {};
                        const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/200';
                        
                        itemsHtml += `
                        <div class="row align-items-center mb-3">
                            <div class="col-3 col-md-2">
                                <img src="${imgUrl}" class="img-fluid rounded" alt="Product" style="height: 60px; object-fit: cover;">
                            </div>
                            <div class="col-9 col-md-4">
                                <h6 class="mb-1">${product.name || 'Unknown Product'}</h6>
                            </div>
                            <div class="col-12 col-md-3 mt-3 mt-md-0">
                                <div class="input-group input-group-sm w-75 mx-md-auto">
                                    <button class="btn btn-outline-secondary" type="button" onclick="updateCartQuantity('${item.id}', ${item.quantity - 1}, ${product.price})">-</button>
                                    <input type="text" class="form-control text-center" value="${item.quantity}" readonly>
                                    <button class="btn btn-outline-secondary" type="button" onclick="updateCartQuantity('${item.id}', ${item.quantity + 1}, ${product.price})">+</button>
                                </div>
                            </div>
                            <div class="col-12 col-md-3 mt-3 mt-md-0 text-md-end">
                                <div class="fw-bold text-primary">৳ ${product.price || 0}</div>
                                <button class="btn btn-link text-danger p-0 mt-2 text-decoration-none fs-7" onclick="removeFromCart('${item.id}')"><i class="fas fa-trash me-1"></i> Remove</button>
                            </div>
                        </div>`;
                    });

                    cartContainer.innerHTML += `
                    <div class="card border-custom shadow-sm mb-4">
                        <div class="card-header bg-white border-bottom border-custom py-3 d-flex align-items-center">
                            <i class="fas fa-store text-primary me-2"></i> 
                            <strong class="me-2">${vendorName}</strong>
                            <span class="badge bg-success bg-opacity-10 text-success">Verified</span>
                        </div>
                        <div class="card-body">
                            ${itemsHtml}
                        </div>
                    </div>`;
                }

                // Update summary
                document.getElementById('summary-subtotal').textContent = `৳ ${cart.total_amount}`;
                document.getElementById('summary-total').textContent = `৳ ${cart.total_amount}`;
                document.getElementById('summary-items').textContent = `Subtotal (${items.reduce((acc, curr) => acc + curr.quantity, 0)} items)`;

            } else {
                cartContainer.innerHTML = '<div class="alert alert-danger">Failed to load cart.</div>';
            }
        } catch (error) {
            console.error('Error fetching cart data:', error);
        }
    }

    window.updateCartQuantity = async function(itemId, newQuantity, unitPrice) {
        if (newQuantity < 1) return;
        const userId = localStorage.getItem('userId');
        try {
            const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/cart/${userId}/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ quantity: newQuantity })
            });
            if (response.ok) {
                loadCartPage();
                if (window.updateHeaderBadges) window.updateHeaderBadges();
            }
        } catch (error) {
            console.error('Error updating quantity', error);
        }
    };

    window.removeFromCart = async function(itemId) {
        if (!confirm('Remove item from cart?')) return;
        const userId = localStorage.getItem('userId');
        try {
            const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/cart/${userId}/items/${itemId}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });
            if (response.ok) {
                loadCartPage();
                if (window.updateHeaderBadges) window.updateHeaderBadges();
            }
        } catch (error) {
            console.error('Error removing item', error);
        }
    };

    loadCartPage();

    // --- Wishlist Page Dynamic Loading ---
    async function loadWishlistPage() {
        const wishlistContainer = document.getElementById('wishlist-items-container');
        if (!wishlistContainer || !window.location.pathname.endsWith('wishlist.html')) return;

        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!token || !userId) {
            wishlistContainer.innerHTML = '<div class="col-12"><div class="alert alert-warning">Please <a href="login.html">login</a> to view your wishlist.</div></div>';
            return;
        }

        wishlistContainer.innerHTML = '<div class="col-12 text-center py-5"><span class="spinner-border text-primary"></span></div>';

        try {
            const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/wishlist/${userId}`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();
            
            if (response.ok && data.success && data.data) {
                const wishlist = data.data;
                const items = wishlist.items || [];
                
                const countText = document.getElementById('wishlist-count-text');
                if (countText) countText.textContent = `(${items.length} items)`;
                
                if (items.length === 0) {
                    wishlistContainer.innerHTML = '<div class="col-12 text-center py-5"><h4>Your wishlist is empty</h4><a href="products.html" class="btn btn-primary mt-3">Discover Products</a></div>';
                    return;
                }

                wishlistContainer.innerHTML = '';
                
                items.forEach(item => {
                    const product = item.product || {};
                    const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/200';
                    
                    wishlistContainer.innerHTML += `
                    <div class="col">
                        <div class="product-card h-100">
                            <a href="product-details.html?id=${product.id}" class="text-decoration-none">
                                <div class="product-image-wrap">
                                    <img src="${imgUrl}" alt="Product" class="product-image" style="height: 200px; object-fit: cover; width: 100%;">
                                </div>
                            </a>
                            <button class="btn-wishlist text-danger border-danger" onclick="removeFromWishlistPage('${item.product_id}', this)"><i class="fas fa-trash"></i></button>
                            <div class="product-info">
                                <a href="product-details.html?id=${product.id}" class="text-decoration-none">
                                    <h3 class="product-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name || 'Unknown Product'}</h3>
                                </a>
                                <div class="product-price mb-2 fw-bold text-primary">৳ ${product.price || 0}</div>
                                <div class="text-success fs-7 mb-3"><i class="fas fa-check-circle me-1"></i> Available</div>
                                <button class="btn btn-primary-custom w-100 text-center d-block text-decoration-none" onclick="addToCart('${product.id}', event)"><i class="fas fa-shopping-cart me-2"></i>Move to Cart</button>
                            </div>
                        </div>
                    </div>`;
                });
            } else {
                wishlistContainer.innerHTML = '<div class="col-12"><div class="alert alert-danger">Failed to load wishlist.</div></div>';
            }
        } catch (error) {
            console.error('Error fetching wishlist data:', error);
        }
    }

    window.removeFromWishlistPage = async function(productId, btnElement) {
        if (!confirm('Remove from wishlist?')) return;
        const userId = localStorage.getItem('userId');
        try {
            const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/wishlist/${userId}/items/${productId}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });
            if (response.ok) {
                loadWishlistPage();
                if (window.updateHeaderBadges) window.updateHeaderBadges();
            }
        } catch (error) {
            console.error('Error removing wishlist item', error);
        }
    };
    
    // Setup clear wishlist button
    const clearWishlistBtn = document.getElementById('clear-wishlist-btn');
    if (clearWishlistBtn) {
        clearWishlistBtn.addEventListener('click', async () => {
            if (!confirm('Clear all items in wishlist?')) return;
            const userId = localStorage.getItem('userId');
            // Assuming the backend has a way to delete all, if not we delete one by one.
            // For now, let's just alert since we might not have a clear-all endpoint.
            alert('Clear all endpoint might not be implemented in backend yet. Please remove items individually.');
        });
    }

    loadWishlistPage();

    // --- Product Details Page Dynamic Loading ---
    async function loadProductDetailsPage() {
        const container = document.getElementById('product-details-container');
        if (!container || !window.location.pathname.endsWith('product-details.html')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (!productId) {
            container.innerHTML = '<div class="col-12"><div class="alert alert-danger">Product ID not provided.</div></div>';
            return;
        }

        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';

        try {
            const response = await fetch(`http://127.0.0.1:8000/api/v1/products/${productId}`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();
            
            if (response.ok && data.success) {
                const product = data.data;
                const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/600';
                const catName = product.category ? product.category.name : 'Uncategorized';
                const vendorName = product.vendor ? product.vendor.shop_name : 'Marketplace Seller';
                const oldPrice = product.price * 1.2; // Mock original price
                
                let qtyHTML = `
                    <div class="input-group" style="width: 130px;">
                        <button class="btn btn-outline-secondary" type="button" onclick="const q=document.getElementById('pd-qty'); if(q.value>1) q.value--;">-</button>
                        <input type="text" id="pd-qty" class="form-control text-center" value="1" readonly>
                        <button class="btn btn-outline-secondary" type="button" onclick="const q=document.getElementById('pd-qty'); if(q.value<${product.stock}) q.value++;">+</button>
                    </div>
                `;
                
                container.innerHTML = `
                <div class="col-lg-5 mb-4 mb-lg-0">
                    <div class="bg-light rounded-3 p-3 mb-3 text-center">
                        <img src="${imgUrl}" class="img-fluid rounded" alt="${product.name}" style="max-height: 400px; object-fit: contain; width: 100%;">
                    </div>
                </div>
                <div class="col-lg-7 px-lg-5">
                    <span class="badge bg-primary bg-opacity-10 text-primary mb-2">${catName}</span>
                    <h1 class="fs-3 fw-bold mb-3">${product.name}</h1>
                    
                    <div class="d-flex align-items-center mb-3">
                        <div class="text-warning me-2">
                            <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
                        </div>
                        <span class="text-muted fs-7">(Verified reviews)</span>
                    </div>

                    <div class="mb-4">
                        <h2 class="fs-2 text-primary fw-bold mb-0">৳ ${product.price}</h2>
                        <span class="text-muted text-decoration-line-through me-2">৳ ${oldPrice.toFixed(2)}</span>
                    </div>

                    <p class="text-secondary-custom mb-4">
                        ${product.description || 'No description available for this product.'}
                    </p>
                    <p class="text-muted mb-4"><strong>Stock:</strong> ${product.stock} items available</p>
                    
                    <hr class="border-custom">

                    <div class="d-flex align-items-center gap-3 mb-4">
                        ${qtyHTML}
                        <button class="btn btn-primary-custom flex-grow-1 text-center d-flex justify-content-center align-items-center" onclick="addPDToCart('${product.id}', event)"><i class="fas fa-shopping-cart me-2"></i> Add to Cart</button>
                        <button class="btn btn-light border p-3 rounded text-danger" onclick="addToWishlist('${product.id}', this)"><i class="far fa-heart"></i></button>
                    </div>

                    <div class="bg-light p-3 rounded border-custom mt-4 d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-store text-primary fs-3 me-3"></i>
                            <div>
                                <h6 class="mb-1">${vendorName}</h6>
                                <div class="text-warning fs-7"><i class="fas fa-star"></i> Trusted Seller</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            } else {
                container.innerHTML = '<div class="col-12"><div class="alert alert-danger">Failed to load product.</div></div>';
            }
        } catch (error) {
            console.error('Error fetching product details:', error);
            container.innerHTML = '<div class="col-12"><div class="alert alert-danger">Network Error</div></div>';
        }
    }

    window.addPDToCart = function(productId, event = null) {
        if (event) event.preventDefault();
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        if (!token || !userId) {
            window.location.href = 'login.html';
            return;
        }
        const qty = parseInt(document.getElementById('pd-qty').value);
        addToCart(productId, event, qty);
    };

    loadProductDetailsPage();

    // --- Checkout Page Dynamic Loading ---
    async function loadCheckoutPage() {
        const container = document.getElementById('checkout-items-container');
        if (!container || !window.location.pathname.endsWith('checkout.html')) return;

        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!token || !userId) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/cart/${userId}`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();
            
            if (response.ok && data.success && data.data) {
                const cart = data.data;
                const items = cart.items || [];
                
                if (items.length === 0) {
                    container.innerHTML = '<div class="alert alert-warning">Your cart is empty. <a href="products.html">Start shopping</a></div>';
                    return;
                }

                container.innerHTML = '';
                
                items.forEach(item => {
                    const product = item.product || {};
                    const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/100';
                    const vendorName = product.vendor ? product.vendor.shop_name : 'Marketplace Seller';
                    
                    container.innerHTML += `
                    <div class="d-flex align-items-center mb-3 pb-3 border-bottom border-custom">
                        <img src="${imgUrl}" class="rounded me-3" style="width: 50px; height: 50px; object-fit: cover;" alt="Product">
                        <div class="flex-grow-1">
                            <h6 class="mb-0 fs-7">${product.name || 'Unknown'}</h6>
                            <small class="text-muted">${vendorName}</small>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold fs-7">৳ ${product.price}</div>
                            <small class="text-muted">Qty: ${item.quantity}</small>
                        </div>
                    </div>`;
                });

                const subtotal = cart.total_amount || 0;
                const shipping = 60; // Mock shipping
                const tax = 0; // Mock tax
                const total = subtotal + shipping + tax;

                document.getElementById('checkout-subtotal').textContent = `৳ ${subtotal}`;
                document.getElementById('checkout-shipping').textContent = `৳ ${shipping}`;
                document.getElementById('checkout-tax').textContent = `৳ ${tax}`;
                document.getElementById('checkout-total').textContent = `৳ ${total}`;
                document.getElementById('checkout-btn-total').textContent = `৳ ${total}`;
            } else {
                container.innerHTML = '<div class="alert alert-danger">Failed to load checkout details.</div>';
            }
        } catch (error) {
            console.error('Error fetching checkout data:', error);
            container.innerHTML = '<div class="alert alert-danger">Network Error</div>';
        }
    }

    window.placeOrder = async function() {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        if (!token || !userId) return;

        // In a real app, this would send an API request to an order endpoint
        alert('Order placed successfully! In a real app this would call the API. Proceeding to notifications...');
        window.location.href = 'notifications.html';
    };

    loadCheckoutPage();

    // --- Profile Page Dynamic Loading ---
    async function loadProfilePage() {
        const profileForm = document.getElementById('profileForm');
        if (!profileForm || !window.location.pathname.endsWith('profile.html')) return;

        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!token || !userId) {
            window.location.href = 'login.html';
            return;
        }

        const btn = document.getElementById('prof-save-btn');
        if (btn) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Loading...';
            btn.disabled = true;
        }

        try {
            const response = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/auth/me`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();
            
            if (response.ok && data.success) {
                const user = data.data;
                document.getElementById('prof-fname').value = user.first_name || '';
                document.getElementById('prof-lname').value = user.last_name || '';
                document.getElementById('prof-email').value = user.email || '';
                document.getElementById('prof-phone').value = user.phone || '';
                
                // Update sidebar name
                const sidebarName = document.querySelector('.col-lg-3 .card-body h5');
                const sidebarEmail = document.querySelector('.col-lg-3 .card-body p');
                if (sidebarName) sidebarName.textContent = `${user.first_name || ''} ${user.last_name || ''}`;
                if (sidebarEmail) sidebarEmail.textContent = user.email || '';
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            if (btn) {
                btn.innerHTML = 'Save Changes';
                btn.disabled = false;
            }
        }

        // Profile Update Handler (Assuming backend has an update user endpoint, mocking it for now)
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('prof-save-btn');
            const spinner = btn.querySelector('.spinner-border');
            const alertBox = document.getElementById('profile-alert');
            
            btn.disabled = true;
            spinner.classList.remove('d-none');
            alertBox.classList.add('d-none');
            
            // Wait a moment to simulate save since no endpoint exists yet
            setTimeout(() => {
                alertBox.textContent = 'Profile updated successfully!';
                alertBox.className = 'alert alert-success mb-3';
                btn.disabled = false;
                spinner.classList.add('d-none');
            }, 1000);
        });
    }

    loadProfilePage();

    // --- Registration API Integration ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('regSubmitBtn');
            const spinner = document.getElementById('regSpinner');
            const btnText = document.getElementById('regBtnText');
            const alertBox = document.getElementById('regAlert');
            
            const firstName = document.getElementById('regFirstName').value.trim();
            const lastName = document.getElementById('regLastName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const role = document.querySelector('input[name="account_role"]:checked').value;
            
            const fullName = `${firstName} ${lastName}`.trim();
            
            // Reset alert
            alertBox.classList.add('d-none');
            alertBox.classList.remove('alert-success', 'alert-danger');
            
            // Show loading
            btn.disabled = true;
            spinner.classList.remove('d-none');
            btnText.textContent = 'Creating Account...';
            
            try {
                const response = await fetch('http://127.0.0.1:8000/api/v1/auth/register', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        full_name: fullName,
                        role: role,
                        password: password
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    alertBox.textContent = data.message || 'Registration successful! Redirecting...';
                    alertBox.classList.add('alert-success');
                    alertBox.classList.remove('d-none');
                    
                    // Redirect to login
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    // Handle validation errors from backend
                    let errorMsg = 'Registration failed. Please try again.';
                    if (data.detail) {
                        if (typeof data.detail === 'string') {
                            errorMsg = data.detail;
                        } else if (Array.isArray(data.detail)) {
                            errorMsg = data.detail.map(err => err.msg).join(', ');
                        }
                    } else if (data.message) {
                        errorMsg = data.message;
                    }
                    
                    alertBox.textContent = errorMsg;
                    alertBox.classList.add('alert-danger');
                    alertBox.classList.remove('d-none');
                    btn.disabled = false;
                    spinner.classList.add('d-none');
                    btnText.textContent = 'Create Account';
                }
                
            } catch (error) {
                console.error('Error during registration:', error);
                alertBox.textContent = 'A network error occurred. Please try again.';
                alertBox.classList.add('alert-danger');
                alertBox.classList.remove('d-none');
                
                btn.disabled = false;
                spinner.classList.add('d-none');
                btnText.textContent = 'Create Account';
            }
        });
    }

    // --- Login API Integration ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('loginSubmitBtn');
            const spinner = document.getElementById('loginSpinner');
            const btnText = document.getElementById('loginBtnText');
            const alertBox = document.getElementById('loginAlert');
            
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            
            // Reset alert
            alertBox.classList.add('d-none');
            alertBox.classList.remove('alert-success', 'alert-danger');
            
            // Show loading
            btn.disabled = true;
            spinner.classList.remove('d-none');
            btnText.textContent = 'Signing in...';
            
            const formData = new URLSearchParams();
            formData.append('grant_type', 'password');
            formData.append('username', email);
            formData.append('password', password);
            
            try {
                const response = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok && data.access_token) {
                    alertBox.textContent = 'Login successful! Redirecting...';
                    alertBox.classList.add('alert-success');
                    alertBox.classList.remove('d-none');
                    
                    localStorage.setItem('accessToken', data.access_token);
                    if (data.refresh_token) {
                        localStorage.setItem('refreshToken', data.refresh_token);
                    }
                    localStorage.setItem('isLoggedIn', 'true');
                    
                    // Decode token to get role or default to customer
                    let role = 'customer'; // Default
                    let userId = '';
                    try {
                        const base64Url = data.access_token.split('.')[1];
                        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                        }).join(''));
                        const payload = JSON.parse(jsonPayload);
                        
                        userId = payload.sub || payload.user_id || payload.id || '';
                        
                        if (payload.role) {
                            role = payload.role.toLowerCase();
                        } else if (payload.user && payload.user.role) {
                            role = payload.user.role.toLowerCase();
                        } else {
                            // If token is valid but has no role, use fallback
                            if (email.toLowerCase().includes('admin') || email === 'user@dev.com') role = 'admin';
                            else if (email.toLowerCase().includes('vendor') || email.toLowerCase().includes('seller')) role = 'vendor';
                        }
                    } catch (err) {
                        console.error('Could not decode token for role:', err);
                        // Fallback logic on error
                        if (email.toLowerCase().includes('admin') || email === 'user@dev.com') role = 'admin';
                        else if (email.toLowerCase().includes('vendor') || email.toLowerCase().includes('seller')) role = 'vendor';
                    }
                    
                    localStorage.setItem('userRole', role);
                    localStorage.setItem('userId', userId);
                    
                    setTimeout(() => {
                        if (role === 'admin') {
                            window.location.href = 'admin-dashboard.html';
                        } else if (role === 'vendor') {
                            window.location.href = 'vendor-dashboard.html';
                        } else {
                            window.location.href = 'index.html';
                        }
                    }, 2000);
                } else {
                    let errorMsg = 'Login failed. Please check your credentials.';
                    if (data.detail) {
                        if (typeof data.detail === 'string') {
                            errorMsg = data.detail;
                        } else if (Array.isArray(data.detail)) {
                            errorMsg = data.detail.map(err => err.msg).join(', ');
                        }
                    } else if (data.message) {
                        errorMsg = data.message;
                    }
                    
                    alertBox.textContent = errorMsg;
                    alertBox.classList.add('alert-danger');
                    alertBox.classList.remove('d-none');
                    btn.disabled = false;
                    spinner.classList.add('d-none');
                    btnText.textContent = 'Sign In';
                }
            } catch (error) {
                console.error('Error during login:', error);
                alertBox.textContent = 'A network error occurred. Please try again.';
                alertBox.classList.add('alert-danger');
                alertBox.classList.remove('d-none');
                
                btn.disabled = false;
                spinner.classList.add('d-none');
                btnText.textContent = 'Sign In';
            }
        });
    }

    // --- Profile Dropdown & API Fetch ---
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const profileIcons = document.querySelectorAll('a[title="Sign In"], a[href="login.html"].nav-icon');
    
    if (isLoggedIn) {
        profileIcons.forEach(icon => {
            // Update icon properties
            icon.title = 'Profile';
            icon.href = '#';
            
            // Create wrapper if not already wrapped
            if (!icon.parentElement.classList.contains('profile-nav-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'profile-nav-wrapper';
                icon.parentNode.insertBefore(wrapper, icon);
                wrapper.appendChild(icon);
                
                // Create dropdown card
                const dropdownCard = document.createElement('div');
                dropdownCard.className = 'profile-dropdown-card';
                dropdownCard.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';
                wrapper.appendChild(dropdownCard);
                
                let isDataLoaded = false;
                
                // Toggle Dropdown
                icon.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Close other open dropdowns if any
                    document.querySelectorAll('.profile-dropdown-card.active').forEach(card => {
                        if (card !== dropdownCard) card.classList.remove('active');
                    });
                    
                    dropdownCard.classList.toggle('active');
                    
                    if (dropdownCard.classList.contains('active') && !isDataLoaded) {
                        try {
                            const response = await fetchWithAuth('http://127.0.0.1:8000/api/v1/auth/me', {
                                headers: {
                                    'Accept': 'application/json'
                                }
                            });
                            
                            const data = await response.json();
                            
                            if (response.ok && data.success) {
                                const u = data.data;
                                const initials = u.full_name ? u.full_name.substring(0, 2).toUpperCase() : 'US';
                                const joinedDate = new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                                
                                dropdownCard.innerHTML = `
                                    <div class="profile-dropdown-header">
                                        <div class="profile-avatar">${initials}</div>
                                        <div class="profile-info">
                                            <h5>${u.full_name}</h5>
                                            <p>${u.email}</p>
                                            <div class="profile-role-badge"><i class="fas ${u.role === 'admin' ? 'fa-user-shield' : (u.role === 'vendor' ? 'fa-store' : 'fa-user')}"></i> ${u.role}</div>
                                        </div>
                                    </div>
                                    <ul class="profile-details-list">
                                        <li><span>Status</span> <span><span class="badge ${u.is_active ? 'bg-success' : 'bg-secondary'}">${u.is_active ? 'Active' : 'Inactive'}</span></span></li>
                                        <li><span>Joined</span> <span>${joinedDate}</span></li>
                                    </ul>
                                    <div class="profile-dropdown-actions">
                                        <a href="${u.role === 'admin' ? 'admin-dashboard.html' : (u.role === 'vendor' ? 'vendor-dashboard.html' : '#')}" class="btn-primary-custom text-center text-decoration-none py-2" style="font-size: 0.9rem;">Dashboard</a>
                                        <button class="btn-logout" id="logoutBtn"><i class="fas fa-sign-out-alt me-2"></i>Logout</button>
                                    </div>
                                `;
                                isDataLoaded = true;
                                
                                // Attach logout event
                                const logoutBtn = dropdownCard.querySelector('#logoutBtn');
                                if (logoutBtn) {
                                    logoutBtn.addEventListener('click', () => {
                                        localStorage.removeItem('accessToken');
                                        localStorage.removeItem('refreshToken');
                                        localStorage.removeItem('isLoggedIn');
                                        localStorage.removeItem('userRole');
                                        window.location.href = 'login.html';
                                    });
                                }
                            } else {
                                dropdownCard.innerHTML = '<div class="text-danger text-center">Session expired. Please <a href="login.html">login again</a>.</div>';
                                localStorage.removeItem('isLoggedIn');
                                localStorage.removeItem('accessToken');
                                localStorage.removeItem('userRole');
                            }
                        } catch (error) {
                            console.error('Error fetching profile:', error);
                            dropdownCard.innerHTML = '<div class="text-danger text-center">Failed to load profile.</div>';
                        }
                    }
                });
                
                // Click outside to close
                document.addEventListener('click', (e) => {
                    if (!wrapper.contains(e.target)) {
                        dropdownCard.classList.remove('active');
                    }
                });
            }
        });
    }

    // --- Global Header Badges Loading ---
    window.updateHeaderBadges = async function() {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!token || !userId) return; // Unauthenticated users don't see badges
        
        const wishlistBadge = document.getElementById('wishlist-badge');
        const cartBadge = document.getElementById('cart-badge');
        const notifBadge = document.getElementById('notification-badge');

        try {
            // Update Cart
            if (cartBadge) {
                const cartRes = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/cart/${userId}`, {
                    headers: { 'Accept': 'application/json' }
                });
                const cartData = await cartRes.json();
                if (cartRes.ok && cartData.success) {
                    const cartItems = cartData.data.items || [];
                    let totalCartQty = 0;
                    cartItems.forEach(i => totalCartQty += i.quantity);
                    if (totalCartQty > 0) {
                        cartBadge.textContent = totalCartQty;
                        cartBadge.classList.remove('d-none');
                    } else {
                        cartBadge.classList.add('d-none');
                    }
                }
            }

            // Update Wishlist
            if (wishlistBadge) {
                const wishRes = await window.fetchWithAuth(`http://127.0.0.1:8000/api/v1/wishlist/${userId}`, {
                    headers: { 'Accept': 'application/json' }
                });
                const wishData = await wishRes.json();
                if (wishRes.ok && wishData.success) {
                    const wishItems = wishData.data.items || [];
                    if (wishItems.length > 0) {
                        wishlistBadge.textContent = wishItems.length;
                        wishlistBadge.classList.remove('d-none');
                    } else {
                        wishlistBadge.classList.add('d-none');
                    }
                }
            }

            // Notifications are currently not implemented in backend, so hide by default
            if (notifBadge) {
                notifBadge.classList.add('d-none');
            }

        } catch (error) {
            console.error('Error updating header badges:', error);
        }
    };

    window.updateHeaderBadges();

});
