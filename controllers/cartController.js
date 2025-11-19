const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price images stock');

    if (!cart) {
      // Create empty cart if doesn't exist
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Calculate totals
    const totalPrice = cart.items.reduce((total, item) => {
      if (item.product) {
        return total + (item.product.price * item.quantity);
      }
      return total;
    }, 0);

    const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);

    res.status(200).json({
      success: true,
      data: { 
        cart,
        totalPrice,
        totalItems
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    // Check if product exists and is in stock
    const product = await Product.findById(productId);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    if (product.stock < quantity) {
      return next(new AppError(`Only ${product.stock} items available in stock`, 400));
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId.toString()
    );

    if (existingItemIndex > -1) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      if (product.stock < newQuantity) {
        return next(new AppError(`Only ${product.stock} items available in stock`, 400));
      }

      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].price = product.price;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        price: product.price
      });
    }

    await cart.save();
    await cart.populate('items.product', 'name price images stock');

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:productId
// @access  Private
exports.updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return next(new AppError('Quantity must be at least 1', 400));
    }

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // Find item in cart
    const item = cart.items.find(
      item => item.product.toString() === productId.toString()
    );

    if (!item) {
      return next(new AppError('Item not found in cart', 404));
    }

    // Check stock availability
    const product = await Product.findById(productId);
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    if (product.stock < quantity) {
      return next(new AppError(`Only ${product.stock} items available in stock`, 400));
    }

    // Update quantity and price
    item.quantity = quantity;
    item.price = product.price;

    await cart.save();
    await cart.populate('items.product', 'name price images stock');

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:productId
// @access  Private
exports.removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // Remove item
    cart.items = cart.items.filter(
      item => item.product.toString() !== productId.toString()
    );

    await cart.save();
    await cart.populate('items.product', 'name price images stock');

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart
// @access  Private
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sync cart (useful after login to merge guest cart)
// @route   POST /api/cart/sync
// @access  Private
exports.syncCart = async (req, res, next) => {
  try {
    const { items } = req.body; // Array of {productId, quantity}

    if (!items || !Array.isArray(items)) {
      return next(new AppError('Invalid cart data', 400));
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    // Merge items from request with existing cart
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product || product.stock < item.quantity) {
        continue; // Skip invalid or out-of-stock products
      }

      const existingItemIndex = cart.items.findIndex(
        cartItem => cartItem.product.toString() === item.productId.toString()
      );

      if (existingItemIndex > -1) {
        // Update quantity (take max of both)
        const newQuantity = Math.max(
          cart.items[existingItemIndex].quantity,
          item.quantity
        );
        
        if (product.stock >= newQuantity) {
          cart.items[existingItemIndex].quantity = newQuantity;
          cart.items[existingItemIndex].price = product.price;
        }
      } else {
        // Add new item
        cart.items.push({
          product: item.productId,
          quantity: item.quantity,
          price: product.price
        });
      }
    }

    await cart.save();
    await cart.populate('items.product', 'name price images stock');

    res.status(200).json({
      success: true,
      message: 'Cart synced successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
};