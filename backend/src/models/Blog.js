const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    content: { type: String, required: true },
    excerpt: { type: String },
    author: { type: String },
    category: { type: String },
    tags: [{ type: String }],
    seo: {
      metaTitle: String,
      metaDescription: String,
    },
    publishedAt: { type: Date },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Blog', blogSchema);
