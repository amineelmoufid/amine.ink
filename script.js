document.addEventListener('DOMContentLoaded', () => {
            const introElement = document.getElementById('intro-text');
            let lineIndex = 0;
            let wordIndex = 0;

            function typeWriter() {
                if (lineIndex < introText.length) {
                    // Find the previous highlight and convert it to plain text
                    const lastHighlight = introElement.querySelector('.typing-highlight');
                    if (lastHighlight) {
                        lastHighlight.outerHTML = lastHighlight.textContent + ' ';
                    }

                    const words = introText[lineIndex].split(' ');
                    if (wordIndex < words.length) {
                        // Add the new word with the highlight
                        introElement.innerHTML += `<span class="typing-highlight">${words[wordIndex]}</span>`;
                        wordIndex++;
                        setTimeout(typeWriter, 150); // Speed between words
                    } else {
                        // Go to the next line
                        introElement.innerHTML += '<br>';
                        lineIndex++;
                        wordIndex = 0;
                        setTimeout(typeWriter, 500); // Pause between lines
                    }
                } else {
                     // Final cleanup: remove the last highlight when done
                    const lastHighlight = introElement.querySelector('.typing-highlight');
                    if (lastHighlight) {
                        lastHighlight.outerHTML = lastHighlight.textContent;
                    }
                }
            }
            typeWriter(); // Start the animation

            const cabinet = document.getElementById('cabinet');
            const cabinetFront = document.querySelector('.cabinet-front');
            const fileStack = document.getElementById('file-stack');
            const cabinetBody = document.querySelector('.cabinet-body');
            const allFolders = [];
            
            let currentlyOpenFolder = null;
            const allowedTabIds = [1, 6, 10, 15, 19];

            portfolioData.forEach((file, i) => {
                const folder = document.createElement('div');
                folder.className = 'file-folder';
                folder.dataset.id = file.id;
                folder.style.transitionDelay = `${0.02 * i}s`;
                
                const visualPart = document.createElement('div');
                visualPart.className = 'folder-visuals';
                
                if (allowedTabIds.includes(file.id)) {
                    folder.classList.add('has-prominent-hover');
                    const tab = document.createElement('div');
                    tab.className = 'tab';
                    const randomFactor = Math.random();
                    tab.style.setProperty('--random-factor', randomFactor);
                    tab.textContent = file.tabLabel;
                    visualPart.appendChild(tab);
                }
                
                const contentArea = document.createElement('div');
                contentArea.className = 'folder-content-area';

                folder.appendChild(visualPart);
                folder.appendChild(contentArea);
                fileStack.appendChild(folder);
                allFolders.push(folder);
            });

            function toggleCabinet() {
                if (currentlyOpenFolder) {
                    closeFolder(currentlyOpenFolder);
                }
                cabinet.classList.toggle('is-open');
                cabinetFront.classList.toggle('no-hover');
                document.body.classList.toggle('cabinet-is-open');
            }

            cabinetFront.addEventListener('click', toggleCabinet);

            window.addEventListener('wheel', (event) => {
                if (!cabinet.classList.contains('is-open') && event.deltaY > 0) {
                    toggleCabinet();
                    event.preventDefault();
                }
            });
            
            function openFolder(folder) {
                
                const folderId = folder.dataset.id;
                const folderIndex = allFolders.indexOf(folder);
                const contentArea = folder.querySelector('.folder-content-area');
                
                const folderTop = folder.getBoundingClientRect().top;
                const desiredTop = window.innerHeight / 2 - 200; 
                const cabinetMoveDistance = desiredTop - folderTop;
                cabinet.style.transform = `translateY(${cabinetMoveDistance}px)`;

                const fileData = portfolioData.find(item => item.id == folderId);
                if (fileData) {
                    contentArea.innerHTML = `
                        <span class="close-folder-button">&times;</span>
                        <h2 class="pulled-folder-title">${fileData.title}</h2>
                        <div class="pulled-folder-text">${fileData.content}</div>
                    `;
                } else {
                    contentArea.innerHTML = `
                        <span class="close-folder-button">&times;</span>
                        <h2 class="pulled-folder-title">File #${String(folderId).padStart(3, '0')}</h2>
                        <div class="pulled-folder-text">File not found.</div>
                    `;
                }
                contentArea.querySelector('.close-folder-button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeFolder(folder);
                });
                
                cabinet.classList.add('folder-is-expanded');
                folder.classList.add('is-expanded');
                currentlyOpenFolder = folder;

                allFolders.forEach((f, index) => {
                    if (index < folderIndex) {
                        f.classList.add('move-up');
                    } else if (index > folderIndex) {
                        f.classList.add('move-down');
                    }
                });
            }

            function closeFolder(folder) {
                
                if (!folder) return;

                cabinet.style.transform = `translateY(0px)`;
                
                cabinet.classList.remove('folder-is-expanded');
                folder.classList.remove('is-expanded');
                currentlyOpenFolder = null;

                allFolders.forEach(f => {
                    f.classList.remove('move-up', 'move-down');
                });
            }

            fileStack.addEventListener('click', (event) => {
                const folder = event.target.closest('.file-folder');
                if (!folder) return;
                if (folder.classList.contains('has-prominent-hover')) {
                    if (currentlyOpenFolder && currentlyOpenFolder !== folder) {
                        closeFolder(currentlyOpenFolder);
                        setTimeout(() => {
                            openFolder(folder);
                        }, 100);
                    } else if (folder.classList.contains('is-expanded') && !event.target.closest('.folder-content-area')) {
                        closeFolder(folder);
                    } else if (!folder.classList.contains('is-expanded')) {
                        openFolder(folder);
                    }
                }
            });

            document.addEventListener('click', (event) => {
                if (currentlyOpenFolder && !currentlyOpenFolder.contains(event.target)) {
                    closeFolder(currentlyOpenFolder);
                } else if (!cabinet.contains(event.target) && cabinet.classList.contains('is-open') && !currentlyOpenFolder) {
                    toggleCabinet();
                }
            });

            

            cabinetBody.addEventListener('click', (event) => {
                if (event.target === cabinetBody && !currentlyOpenFolder) {
                    toggleCabinet();
                }
            });

            // --- Start of new pop-up code to be added ---

            // Create and append the skill pop-up element once
            const skillPopup = document.createElement('div');
            skillPopup.id = 'skill-popup';
            document.body.appendChild(skillPopup);

            // Replace the old 'mouseover' listener with this one:
fileStack.addEventListener('mouseover', (event) => {
    const targetBox = event.target.closest('.skill-box');
    if (targetBox) {
        const fullContent = targetBox.dataset.fullContent;
        if (fullContent) {
            skillPopup.innerHTML = fullContent;
            skillPopup.style.display = 'block';
        }
    }
});

// Replace the old 'mouseout' listener with this one:
fileStack.addEventListener('mouseout', (event) => {
    const targetBox = event.target.closest('.skill-box');
    if (targetBox) {
        skillPopup.style.display = 'none';
    }
});

            fileStack.addEventListener('mousemove', (event) => {
                // Position the pop-up near the cursor, with an offset to avoid flickering
                const offsetX = 15;
                const offsetY = 15;
                skillPopup.style.left = `${event.pageX + offsetX}px`;
                skillPopup.style.top = `${event.pageY + offsetY}px`;
            });

            // --- End of new pop-up code ---
        });
