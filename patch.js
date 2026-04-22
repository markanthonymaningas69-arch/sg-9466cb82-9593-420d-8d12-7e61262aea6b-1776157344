const fs = require('fs');
let code = fs.readFileSync('src/pages/bom/[projectId].tsx', 'utf8');

const classMap = {
    'space-y-4': 'space-y-1.5',
    'pt-6': 'pt-2',
    'pb-3': 'pb-1',
    'py-2': 'py-1',
    'pt-4': 'pt-2',
    'pb-4': 'pb-2',
    'mt-4': 'mt-2',
    'mb-4': 'mb-2',
    'mt-3': 'mt-1',
    'mb-3': 'mb-1',
    'mt-2': 'mt-0.5',
    'mb-2': 'mb-0.5',
    'py-1': 'py-0.5',
    'pt-3': 'pt-1.5',
    'h-8': 'h-7', 
    'h-7': 'h-6',
    'text-4xl': 'text-2xl',
    'text-3xl': 'text-2xl',
    'text-2xl': 'text-xl',
    'text-xl': 'text-lg',
    'text-lg': 'text-base'
};

const regex = new RegExp('\\b(' + Object.keys(classMap).join('|') + ')\\b', 'g');
code = code.replace(regex, (match) => classMap[match]);

fs.writeFileSync('src/pages/bom/[projectId].tsx', code);
console.log('Vertical compression applied successfully.');
