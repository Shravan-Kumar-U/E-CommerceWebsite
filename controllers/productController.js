const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');
const { deleteImage } = require('../utils/cloudinary');

// @desc    Get all products with filters
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      minRating,
      sort,
      page,
      limit
    } = req.query;

    const result = await Product.getProducts({
      search,
      category,
      minPrice,
      maxPrice,
      minRating,
      sort,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('reviews.user', 'name');

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    res.status(200).json({
      success: true,
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product (Admin)
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category } = req.body;

    // Handle image uploads from req.files (if using multer)
    const images = [];
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push({
          url: file.path, // Cloudinary URL
          public_id: file.filename // Cloudinary public_id
        });
      });
    }

    const product = await Product.create({
      name,
      description,
      price,
      stock,
      category,
      images
    });

    await product.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product (Admin)
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res, next) => {
  try {
    const { name, description, price, stock, category } = req.body;

    let product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
      
      product.images.push(...newImages);
    }

    // Update other fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (category) product.category = category;

    await product.save();
    await product.populate('category', 'name slug');

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product image (Admin)
// @route   DELETE /api/products/:id/images/:imageId
// @access  Private/Admin
exports.deleteProductImage = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const image = product.images.id(imageId);

    if (!image) {
      return next(new AppError('Image not found', 404));
    }

    // Delete from Cloudinary
    if (image.public_id) {
      await deleteImage(image.public_id);
    }

    // Remove from product
    product.images.pull(imageId);
    await product.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: { images: product.images }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (Admin)
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Delete all images from Cloudinary
    for (const image of product.images) {
      if (image.public_id) {
        await deleteImage(image.public_id);
      }
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// REVIEWS
// ============================================

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private
exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const productId = req.params.id;

    const product = await Product.findById(productId);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      review => review.user.toString() === req.user.id.toString()
    );

    if (alreadyReviewed) {
      return next(new AppError('You have already reviewed this product', 400));
    }

    // Add review
    product.reviews.push({
      user: req.user.id,
      userName: req.user.name,
      rating,
      comment
    });

    // Calculate new average rating
    product.calculateAverageRating();

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: { 
        reviews: product.reviews,
        averageRating: product.averageRating,
        numReviews: product.numReviews
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product review
// @route   PUT /api/products/:id/reviews/:reviewId
// @access  Private
exports.updateReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const { id, reviewId } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const review = product.reviews.id(reviewId);

    if (!review) {
      return next(new AppError('Review not found', 404));
    }

    // Check if user owns the review
    if (review.user.toString() !== req.user.id.toString()) {
      return next(new AppError('You can only update your own reviews', 403));
    }

    // Update review
    if (rating) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    // Recalculate average rating
    product.calculateAverageRating();

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: { 
        reviews: product.reviews,
        averageRating: product.averageRating
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product review
// @route   DELETE /api/products/:id/reviews/:reviewId
// @access  Private
exports.deleteReview = async (req, res, next) => {
  try {
    const { id, reviewId } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const review = product.reviews.id(reviewId);

    if (!review) {
      return next(new AppError('Review not found', 404));
    }

    // Check if user owns the review or is admin
    if (review.user.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return next(new AppError('Not authorized to delete this review', 403));
    }

    // Remove review
    product.reviews.pull(reviewId);

    // Recalculate average rating
    product.calculateAverageRating();

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: { 
        reviews: product.reviews,
        averageRating: product.averageRating,
        numReviews: product.numReviews
      }
    });
  } catch (error) {
    next(error);
  }
};