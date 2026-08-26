// terminology.js

const TerminologyEngine = {
    terms: {
        'student': 'Student',
        'student_plural': 'Students',
        'teacher': 'Teacher',
        'teacher_plural': 'Teachers',
        'roll_number': 'Roll Number',
        'department': 'Department',
        'class': 'Class',
        'classes': 'Classes'
    },

    departments: ['Computer Science', 'Electronics & Communication', 'Mechanical Engineering'],
    classes: ['CS-201', 'CS-202', 'CS-203', 'EC-201'],

    async init() {
        try {
            const response = await fetch('/api/config/public');
            if (response.ok) {
                const data = await response.json();
                if (data.departments && data.departments.length > 0) {
                    this.departments = data.departments;
                }
                if (data.classes && data.classes.length > 0) {
                    this.classes = data.classes;
                }
            }
        } catch (e) {
            console.error('Failed to load terminology config', e);
        }
        
        this.applyTerms();
    },

    getTerm(key) {
        return this.terms[key] || key;
    },

    applyTerms() {
        const elements = document.querySelectorAll('[data-term]');
        elements.forEach(el => {
            const termKey = el.getAttribute('data-term');
            const translation = this.getTerm(termKey);
            
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.hasAttribute('placeholder')) {
                    if (el.getAttribute('data-term-placeholder') === 'true') {
                        el.placeholder = translation;
                    } else if (el.placeholder.toLowerCase().includes('roll number')) {
                        el.placeholder = el.placeholder.replace(/roll number/gi, translation);
                    } else if (el.placeholder.toLowerCase().includes('student')) {
                        el.placeholder = el.placeholder.replace(/student/gi, translation);
                    }
                }
            } else if (el.tagName === 'OPTION') {
                if (el.getAttribute('data-term-option') === 'true') {
                    if (el.innerText.toLowerCase().includes('department')) {
                        el.innerText = el.innerText.replace(/department/gi, translation);
                    } else if (el.innerText.toLowerCase().includes('student')) {
                        el.innerText = el.innerText.replace(/student/gi, translation);
                    }
                }
            } else {
                if (el.children.length === 0) {
                    const isUpper = el.innerText && el.innerText === el.innerText.toUpperCase() && el.innerText !== el.innerText.toLowerCase();
                    el.innerText = isUpper ? translation.toUpperCase() : translation;
                } else {
                    for (let node of el.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
                            node.nodeValue = " " + translation + " ";
                            break;
                        }
                    }
                }
            }
        });

        // Update dynamic department dropdowns
        const deptSelects = document.querySelectorAll('select[data-dynamic-departments="true"]');
        
        deptSelects.forEach(select => {
            const placeholder = select.querySelector('option[disabled]');
            const currentValue = select.getAttribute('data-preserve-value') || select.value;
            
            select.innerHTML = '';
            if (placeholder) {
                select.appendChild(placeholder);
            }

            this.departments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept;
                opt.textContent = dept;
                select.appendChild(opt);
            });

            if (currentValue && currentValue !== '') {
                let found = Array.from(select.options).some(o => o.value === currentValue);
                if (!found && !placeholder?.selected) {
                    const opt = document.createElement('option');
                    opt.value = currentValue;
                    opt.textContent = currentValue + ' (Legacy)';
                    select.appendChild(opt);
                }
                select.value = currentValue;
            }
        });
        
        // Update dynamic classes dropdowns
        const classSelects = document.querySelectorAll('select[data-dynamic-classes="true"]');
        
        classSelects.forEach(select => {
            const placeholder = select.querySelector('option[disabled]');
            const currentValue = select.getAttribute('data-preserve-value') || select.value;
            
            select.innerHTML = '';
            if (placeholder) {
                select.appendChild(placeholder);
            }

            this.classes.forEach(cls => {
                const opt = document.createElement('option');
                opt.value = cls;
                opt.textContent = cls;
                select.appendChild(opt);
            });

            if (currentValue && currentValue !== '') {
                let found = Array.from(select.options).some(o => o.value === currentValue);
                if (!found && !placeholder?.selected) {
                    const opt = document.createElement('option');
                    opt.value = currentValue;
                    opt.textContent = currentValue + ' (Legacy)';
                    select.appendChild(opt);
                }
                select.value = currentValue;
            }
        });
    }
};

// Initialize as soon as DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    TerminologyEngine.init();
});
