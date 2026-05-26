import type { ThemeConfig } from './types'

export const themeConfig: ThemeConfig = {
  // SITE INFO ///////////////////////////////////////////////////////////////////////////////////////////
  site: {
    website: 'https://stoa.news/', // Site domain
    title: 'Stoa News', // Site title
    brandName: 'stoa.news', // Brand name shown on post headers
    author: 'Willian Matiola', // Author name
    authorAvatar: '', // Optional author photo path, e.g. '/author.jpg'
    description: 'A Stoa é um blog escrito por Willian Matiola, um designer, escritor e fotógrafo que escreve sobre design, vida, sociedade, filosofia e outras coisas interessantes.', // Site description
    language: 'pt-BR' // Default language
  },

  // GENERAL SETTINGS ////////////////////////////////////////////////////////////////////////////////////
  general: {
    contentWidth: '40rem', // Content area width
    centeredLayout: true, // Use centered layout (false for left-aligned)
    postListDottedDivider: false, // Show dotted divider in post list
    footer: true, // Show footer
    fadeAnimation: true // Enable fade animations
  },

  // DATE SETTINGS ///////////////////////////////////////////////////////////////////////////////////////
  date: {
    dateFormat: 'DD-MM-YYYY', // Date format: YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY, MONTH DAY YYYY, DAY MONTH YYYY
    dateSeparator: '/', // Date separator: . - / (except for MONTH DAY YYYY and DAY MONTH YYYY)
    dateOnRight: true // Date position in post list (true for right, false for left)
  },

  // POST SETTINGS ///////////////////////////////////////////////////////////////////////////////////////
  post: {
    readingTime: true, // Show reading time in posts
    toc: true, // Show table of contents (when there is enough page width)
    imageViewer: true, // Enable image viewer
    copyCode: true, // Enable copy button in code blocks
    linkCard: true, // Enable link card
    katex: true // Enable KaTeX math rendering
  }
}
