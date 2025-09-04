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
                document.body.classList.add('folder-is-expanded-globally');
                
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
                        <div class="pulled-folder-text" id="about-me-text-content">${fileData.content}</div>
                    `;

                    // Text preparation for "About Me" folder (ID 19)
                    if (folderId == 19) {
                        const textContentDiv = contentArea.querySelector('#about-me-text-content');
                        const originalText = textContentDiv.textContent; // Use textContent to avoid HTML issues
                        const words = originalText.split(/\s+/); // Split by one or more spaces

                        let wordSpans = '';
                        words.forEach((word, index) => {
                            wordSpans += `<span class="word" data-word-index="${index}">${word}</span> `;
                        });
                        textContentDiv.innerHTML = wordSpans.trim(); // Trim trailing space
                    }

// Add this block to auto-open the modal for the skills folder
// New logic to auto-open only the FIRST skill box content in the modal
const firstSkillBox = contentArea.querySelector('.skill-box');
if (firstSkillBox) {
    const fullContent = firstSkillBox.dataset.fullContent;
    if (fullContent) {
        skillModalContent.innerHTML = fullContent;
        skillModalContent.appendChild(modalCloseButton); // Re-append close button
        skillModal.style.display = 'flex';
        skillModal.classList.add('is-visible');
    }
}
                } else {
                    contentArea.innerHTML = `
                        <span class="close-folder-button">&times;</span>
                        <h2 class="pulled-folder-title">File #${String(folderId).padStart(3, '0')}</h2>
                        <div class="pulled-folder-text">File not found.</div>
                    `;
                }

                // Audio player for "About Me" folder (ID 19)
                if (folderId == 19) {
                    const audioPlayer = document.createElement('audio');
                    audioPlayer.id = 'about-me-audio';
                    audioPlayer.src = 'assets/audio/about_me.mp3';
                    audioPlayer.preload = 'auto';
                    document.body.appendChild(audioPlayer); // Audio player still needs to be in body for global control

                    const audioButton = document.createElement('button');
                    audioButton.id = 'audio-control-button';
                    audioButton.classList.add('play'); // Initial state
                    contentArea.appendChild(audioButton); // Append to contentArea

                    let currentHighlightedWordIndex = -1; // Keep track of the highlighted word

                    function handleTimeUpdate() {
                        const currentTime = audioPlayer.currentTime;
                        let newHighlightedWordIndex = -1;

                        for (let i = 0; i < aboutMeTimestamps.length; i++) {
                            const timestamp = aboutMeTimestamps[i];
                            if (currentTime >= timestamp.start && currentTime <= timestamp.end) {
                                newHighlightedWordIndex = i;
                                break;
                            }
                        }

                        if (newHighlightedWordIndex !== currentHighlightedWordIndex) {
                            // Remove highlight from previous word
                            if (currentHighlightedWordIndex !== -1) {
                                const prevWordSpan = contentArea.querySelector(`.word[data-word-index="${currentHighlightedWordIndex}"]`);
                                if (prevWordSpan) {
                                    prevWordSpan.classList.remove('current-word-highlight');
                                }
                            }

                            // Add highlight to new word
                            if (newHighlightedWordIndex !== -1) {
                                const newWordSpan = contentArea.querySelector(`.word[data-word-index="${newHighlightedWordIndex}"]`);
                                if (newWordSpan) {
                                    newWordSpan.classList.add('current-word-highlight');
                                }
                            }
                            currentHighlightedWordIndex = newHighlightedWordIndex;
                        }
                    }

                    audioButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (audioPlayer.paused) {
                            audioPlayer.play();
                            audioButton.classList.remove('play');
                            audioButton.classList.add('pause');
                            audioPlayer.addEventListener('timeupdate', handleTimeUpdate); // Attach listener on play
                        } else {
                            audioPlayer.pause();
                            audioButton.classList.remove('pause');
                            audioButton.classList.add('play');
                            audioPlayer.removeEventListener('timeupdate', handleTimeUpdate); // Detach listener on pause
                        }
                    });

                    // Ensure audio stops and button resets if user navigates away or closes
                    audioPlayer.addEventListener('ended', () => {
                        audioButton.classList.remove('pause');
                        audioButton.classList.add('play');
                        audioPlayer.removeEventListener('timeupdate', handleTimeUpdate); // Detach listener on end
                        // Also remove highlight when audio ends
                        if (currentHighlightedWordIndex !== -1) {
                            const prevWordSpan = contentArea.querySelector(`.word[data-word-index="${currentHighlightedWordIndex}"]`);
                            if (prevWordSpan) {
                                prevWordSpan.classList.remove('current-word-highlight');
                            }
                            currentHighlightedWordIndex = -1;
                        }
                    });
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
                document.body.classList.remove('folder-is-expanded-globally');
                
                if (!folder) return;

                // Clean up audio player and button if they exist
                const audioPlayer = document.getElementById('about-me-audio');
                const audioButton = document.getElementById('audio-control-button');

                if (audioPlayer) {
                    audioPlayer.pause();
                    audioPlayer.currentTime = 0; // Reset audio to beginning
                    audioPlayer.removeEventListener('timeupdate', handleTimeUpdate); // Detach listener
                    audioPlayer.remove();
                }
                if (audioButton) {
                    audioButton.remove();
                }
                // Also remove any lingering highlight when folder closes
                const highlightedWord = document.querySelector('.current-word-highlight');
                if (highlightedWord) {
                    highlightedWord.classList.remove('current-word-highlight');
                }

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
            const skillTooltip = document.createElement('div');
            skillTooltip.id = 'skill-tooltip';
            document.body.appendChild(skillTooltip);

            // --- Start of new static modal code ---

// Create the static modal elements once
const skillModal = document.createElement('div');
skillModal.id = 'skill-modal';
const skillModalContent = document.createElement('div');
skillModalContent.className = 'skill-modal-content';
const modalCloseButton = document.createElement('span');
modalCloseButton.className = 'skill-modal-close';
modalCloseButton.innerHTML = '&times;'; // The 'X' character
skillModal.appendChild(skillModalContent);
skillModalContent.appendChild(modalCloseButton);
document.body.appendChild(skillModal);

// Add a click listener for the skill boxes to open the modal
fileStack.addEventListener('click', (event) => {
    const target = event.target.closest('.skill-box, .info-box, .concept-item');
    if (target) {
        const fullContent = target.dataset.fullContent;
        if (fullContent) {
            skillModalContent.innerHTML = fullContent; // Main content
            skillModalContent.appendChild(modalCloseButton); // Re-append close button
            skillModal.style.display = 'flex';
            skillModal.classList.add('is-visible');
        }
    }
});

// Add a click listener to close the modal
modalCloseButton.addEventListener('click', () => {
    skillModal.classList.remove('is-visible');
    skillModal.style.display = 'none';
});

// Prevent clicks inside the content area from closing the modal
skillModalContent.addEventListener('click', (event) => {
    event.stopPropagation();
});

// Also close the modal if the user clicks the overlay background
skillModal.addEventListener('click', (event) => {
    if (event.target === skillModal) {
        skillModal.classList.remove('is-visible');
        skillModal.style.display = 'none';
        event.stopPropagation();
    }
});

// New listener to handle the accordion inside the modal
skillModalContent.addEventListener('click', (event) => {
    const trigger = event.target.closest('.accordion-trigger');
    if (trigger) {
        const panel = trigger.nextElementSibling;
        trigger.classList.toggle('is-active');
        if (panel.style.maxHeight) {
            panel.style.maxHeight = null;
        } else {
            panel.style.maxHeight = panel.scrollHeight + 'px';
        }
    }
});

// --- End of new static modal code ---

// --- Start of Unified Tooltip Logic ---
document.addEventListener('mouseover', (event) => {
    const target = event.target.closest('.skill-list li, .concept-item, .info-box, .skill-box');
    if (target) {
        const description = target.dataset.description || target.dataset.fullContent;
        if (description) {
            let content = description;
            if (target.matches('.skill-list li')) {
                content = `<strong>${target.textContent}</strong>: ${description}`;
            }
            skillTooltip.innerHTML = content;
            skillTooltip.style.display = 'block';
        }
    } else {
        // If we are not hovering a valid target, hide the tooltip
        const isOverTooltip = event.target.closest('#skill-tooltip');
        if (!isOverTooltip) {
             skillTooltip.style.display = 'none';
        }
    }
});

document.addEventListener('mousemove', (event) => {
    if (skillTooltip.style.display === 'block') {
        const offsetX = 15;
        const offsetY = 15;
        skillTooltip.style.left = `${event.pageX + offsetX}px`;
        skillTooltip.style.top = `${event.pageY + offsetY}px`;
    }
});
// --- End of Unified Tooltip Logic ---

            // --- End of new pop-up code ---
        });