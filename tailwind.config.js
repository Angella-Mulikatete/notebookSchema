module.exports = {
      darkMode: 'class', // Enable dark mode using a class
      content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
      theme: {
        extend: {
          colors: {
            brand: {
              primary: '#35b544',      // brand_green
              secondary: '#e1f4e4',    // brand_secondary
              tertiary: '#2a8a34',     // brand_tertiary
              grey: '#424242',        // brand_grey
              yellow: '#fbdf64',      // brand_yellow
              red: '#ef4444',         // brand_red (for destructive actions)
            },
            // For easier access if not using the nested 'brand.primary'
            'brand-primary': '#35b544',
            'brand-secondary': '#e1f4e4',
            'brand-tertiary': '#2a8a34',
            'brand-grey': '#424242',
            'brand-yellow': '#fbdf64',
            'brand-red': '#ef4444',

            // Dark theme specific colors
            dark: {
              background: '#1a202c', // Example: Dark grey/blue
              surface: '#2d3748',    // Example: Slightly lighter for cards/surfaces
              text: '#e2e8f0',       // Example: Light grey for text
              'text-secondary': '#a0aec0', // Example: Medium grey for secondary text
              primary: '#35b544', // Keep brand primary
              'primary-hover': '#2a8a34', // Keep brand tertiary for hover
            }
          },
          textColor: {
            'accent-text': '#35b544', 
          },
        },
      },
      plugins: [],
    };
