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

            const aboutMeAudio = document.getElementById('about-me-audio');
            const experiencesAudio = document.getElementById('experiences-audio');
            const personalityAudio = document.getElementById('personality-audio');
            const skillsAudio = document.getElementById('skills-audio');

            const cabinet = document.getElementById('cabinet');
            const cabinetFront = document.querySelector('.cabinet-front');
            const fileStack = document.getElementById('file-stack');
            const cabinetBody = document.querySelector('.cabinet-body');
            const allFolders = [];
            
            let currentlyOpenFolder = null;
            let currentlyDisplayedModalTarget = null; // New: Track which modal is open
            let currentActiveAudio = null; // Track which audio is currently associated with a transcript
            const allowedTabIds = [1, 6, 10, 15, 19, 23];

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
                        <div class="pulled-folder-text">${fileData.content}</div>
                    `;
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

                const audioSections = {
                    '1': { 
                        type: 'structured', 
                        audioElId: 'what-ive-done-audio', 
                        timestamps: whatIveDoneTimestamps,
                        targetElementsSelector: '[data-target]', // Selector for all highlightable elements
                        highlightClass: 'highlight-sentence'  // The CSS class to apply
                    },
                    '6':  { 
                        type: 'structured', 
                        audioElId: 'skills-audio', 
                        timestamps: skillsTimestamps,
                        // We are keeping the sentence-by-sentence logic for this one
                    },
                    '10': { type: 'prose', audioElId: 'personality-audio', timestamps: personalityTimestamps },
                    '15': { type: 'prose', audioElId: 'experiences-audio', timestamps: experiencesTimestamps },
                    '19': { type: 'prose', audioElId: 'about-me-audio', timestamps: aboutMeTimestamps }
                };


                const config = audioSections[folderId];
                if (config) {
                    if (config.type === 'prose') {
                        currentActiveAudio = config.audioEl;
                        const textContainer = contentArea.querySelector('.pulled-folder-text');
                        textContainer.innerHTML = ''; // Clear it first
                        initializeProseTranscript(contentArea, textContainer, config);
                    } else if (config.type === 'structured') {
                        initializeStructuredTranscript(contentArea, config);
                    }
                }
            }

            function initializeProseTranscript(contentArea, textContainer, config) {
                const audio = document.getElementById(config.audioElId);
                if (!audio) return;

                const audioControlBtn = document.createElement('button');
                audioControlBtn.id = 'audio-control-button';
                contentArea.appendChild(audioControlBtn);

                config.timestamps.forEach(item => {
                    const span = document.createElement('span');
                    span.innerHTML = (item.html || item.text) + ' ';
                    span.dataset.start = item.start;
                    span.dataset.end = item.end;
                    textContainer.appendChild(span);
                });

                const timeUpdateHandler = () => syncHighlight(audio.currentTime);
                const endedHandler = () => {
                    syncHighlight(-1);
                    audioControlBtn.classList.remove('is-playing');
                };

                audio.addEventListener('timeupdate', timeUpdateHandler);
                audio.addEventListener('ended', endedHandler);

                textContainer.addEventListener('click', (event) => {
                    if (event.target.tagName === 'SPAN' && event.target.dataset.start) {
                        audio.currentTime = parseFloat(event.target.dataset.start);
                        audio.play();
                        audioControlBtn.classList.add('is-playing');
                    }
                });

                audioControlBtn.addEventListener('click', () => {
                    if (audio.paused) {
                        audio.play();
                        audioControlBtn.classList.add('is-playing');
                    } else {
                        audio.pause();
                        audioControlBtn.classList.remove('is-playing');
                    }
                });
            }

            function openModalForContent(targetElement) {
                if (!targetElement) return;
                const fullContent = targetElement.dataset.fullContent;
                if (fullContent) {
                    skillModalContent.innerHTML = fullContent;
                    skillModalContent.appendChild(modalCloseButton); // Re-append close button
                    skillModal.style.display = 'flex';
                    skillModal.classList.add('is-visible');
                    currentlyDisplayedModalTarget = targetElement.getAttribute('data-skill') || targetElement.getAttribute('data-concept');
                }
            }

            function syncStructuredHighlight(currentTime, contentArea, config) {
                // Check if the timestamp data is nested for modal-based playback
                const isNestedData = config.timestamps.length > 0 && config.timestamps[0].timings;

                if (isNestedData) {
                    let activeGroup = null;

                    // Find which group of timings is currently active
                    for (const group of config.timestamps) {
                        const firstSentence = group.timings[0];
                        const lastSentence = group.timings[group.timings.length - 1];
                        if (currentTime >= firstSentence.start && currentTime <= lastSentence.end) {
                            activeGroup = group;
                            break;
                        }
                    }

                    if (activeGroup) {
                        // NEW LOGIC: Check if the active group is for the main content area
                        if (activeGroup.isMainContent) {
                            // Handle highlighting directly in the folder's content area
                            let activeTargetSelector = null;
                            activeGroup.timings.forEach(item => {
                                if (currentTime >= item.start && currentTime < item.end) {
                                    activeTargetSelector = item.targetSelector;
                                }
                            });
                        
                            const allTargets = contentArea.querySelectorAll('[data-target]');
                            allTargets.forEach(target => {
                                const shouldHighlight = activeTargetSelector && target.matches(activeTargetSelector);
                                target.classList.toggle('highlight-sentence', shouldHighlight);
                            });

                            // Ensure modal is closed
                            if (skillModal.style.display === 'flex') {
                                skillModal.style.display = 'none';
                                skillModal.classList.remove('is-visible');
                                currentlyDisplayedModalTarget = null;
                            }

                        } else {
                            // Handle modal sequencing and highlighting
                            const activeTargetSelector = activeGroup.targetSelector;
                            const activeTargetIdentifier = contentArea.querySelector(activeTargetSelector)?.getAttribute('data-concept') || contentArea.querySelector(activeTargetSelector)?.getAttribute('data-skill');

                            // Open the correct modal if it's not already open
                            if (activeTargetIdentifier && activeTargetIdentifier !== currentlyDisplayedModalTarget) {
                                openModalForContent(contentArea.querySelector(activeTargetSelector));
                            }

                            // Highlight sentence inside the modal
                            if (skillModal.style.display === 'flex') {
                                const isSelectorBased = activeGroup.timings[0].sentenceSelector;
                                if (isSelectorBased) {
                                    let activeSentenceSelector = null;
                                    for (const sentence of activeGroup.timings) {
                                        if (currentTime >= sentence.start && currentTime <= sentence.end) {
                                            activeSentenceSelector = sentence.sentenceSelector;
                                            break;
                                        }
                                    }
                                    const allSentences = skillModalContent.querySelectorAll('[data-sentence-id]');
                                    allSentences.forEach(s => s.classList.remove('highlight-sentence'));
                                    if (activeSentenceSelector) {
                                        const activeEl = skillModalContent.querySelector(activeSentenceSelector);
                                        if (activeEl) activeEl.classList.add('highlight-sentence');
                                    }
                                } else { // Fallback for index-based (My Skills)
                                    let activeSentenceIndex = -1;
                                    for (let i = 0; i < activeGroup.timings.length; i++) {
                                        if (currentTime >= activeGroup.timings[i].start && currentTime <= activeGroup.timings[i].end) {
                                            activeSentenceIndex = i;
                                            break;
                                        }
                                    }
                                    const listItems = skillModalContent.querySelectorAll('li');
                                    listItems.forEach((li, index) => li.classList.toggle('highlight-sentence', index === activeSentenceIndex));
                                }
                            }
                        }
                    } else {
                        // No active group, close modal and clear highlights
                        if (skillModal.style.display === 'flex') {
                            skillModal.style.display = 'none';
                            skillModal.classList.remove('is-visible');
                            currentlyDisplayedModalTarget = null;
                        }
                        const allTargets = contentArea.querySelectorAll('[data-target]');
                        allTargets.forEach(target => target.classList.remove('highlight-sentence'));
                    }
                    return; // End execution for nested data
                }
            
                // --- Fallback Logic for flat structured sections ---
                let activeTargetSelector = null;
                config.timestamps.forEach(item => {
                    if (currentTime >= item.start && currentTime < item.end) {
                        activeTargetSelector = item.targetSelector;
                    }
                });
            
                const allTargets = contentArea.querySelectorAll(config.targetElementsSelector);
                allTargets.forEach(target => {
                    const shouldHighlight = activeTargetSelector && target.matches(activeTargetSelector);
                    target.classList.toggle(config.highlightClass, shouldHighlight);
                });
            }

            function initializeStructuredTranscript(contentArea, config) {
                const audio = document.getElementById(config.audioElId);
                if (!audio) return;
                currentActiveAudio = audio;
            
                const button = document.createElement('button');
                button.id = 'audio-control-button';
                contentArea.appendChild(button);
                
                button.addEventListener('click', () => {
                    if (audio.paused) {
                        // If starting from the beginning and it's a modal-based folder, open the first modal.
                        if (audio.currentTime === 0 && config.timestamps[0].timings && !config.timestamps[0].isMainContent) {
                            const firstGroup = config.timestamps[0];
                            openModalForContent(contentArea.querySelector(firstGroup.targetSelector));
                        }
                        audio.play();
                        button.classList.add('is-playing');
                    } else {
                        audio.pause();
                        button.classList.remove('is-playing');
                    }
                });
                
                const onTimeUpdate = () => syncStructuredHighlight(audio.currentTime, contentArea, config);
                audio.addEventListener('timeupdate', onTimeUpdate);
                audio.addEventListener('ended', () => {
                    onTimeUpdate(-1); // Remove highlights
                    button.classList.remove('is-playing');
                    // Close the modal at the end of playback
                    if (skillModal.style.display === 'flex') {
                        skillModal.style.display = 'none';
                        skillModal.classList.remove('is-visible');
                        currentlyDisplayedModalTarget = null;
                    }
                });
            
                // Click-to-play functionality
                contentArea.addEventListener('click', (event) => {
                    const clickableItem = event.target.closest('.skill-box, .concept-item');
                    if (clickableItem) {
                        const targetAttr = clickableItem.getAttribute('data-skill') || clickableItem.getAttribute('data-concept');
                        const dataSelector = clickableItem.getAttribute('data-skill') ? `[data-skill='${targetAttr}']` : `[data-concept='${targetAttr}']`;
                        const group = config.timestamps.find(t => t.targetSelector === dataSelector);
                        
                        if (group && group.timings.length > 0) {
                            openModalForContent(clickableItem);
                            audio.currentTime = group.timings[0].start;
                            audio.play();
                            button.classList.add('is-playing');
                        }
                        return;
                    }
            
                    // Generic handler for main content sentences
                    const target = event.target.closest('[data-target]');
                    if (!target) return;
            
                    // Find the timestamp in the main content group
                    const mainContentGroup = config.timestamps.find(g => g.isMainContent);
                    if (mainContentGroup) {
                        const timestamp = mainContentGroup.timings.find(t => target.matches(t.targetSelector));
                        if (timestamp) {
                            audio.currentTime = timestamp.start;
                            audio.play();
                            button.classList.add('is-playing');
                        }
                    }
                });
            
                // ADD a NEW click handler for the modal content itself
                skillModalContent.addEventListener('click', (event) => {
                    if (currentActiveAudio !== audio) return; // Only act on the relevant audio

                    const sentenceEl = event.target.closest('[data-sentence-id]');
                    if (sentenceEl) {
                        const sentenceId = sentenceEl.getAttribute('data-sentence-id');
                        const currentGroup = config.timestamps.find(g => g.targetSelector.includes(currentlyDisplayedModalTarget));
                        if (currentGroup) {
                            const sentenceData = currentGroup.timings.find(t => t.sentenceSelector && t.sentenceSelector.includes(sentenceId));
                            if (sentenceData) {
                                audio.currentTime = sentenceData.start;
                                if(audio.paused) audio.play();
                            }
                        }
                        return;
                    }

                    // Fallback for index-based li (My Skills)
                    const listItem = event.target.closest('li');
                    if (listItem) {
                        const allListItems = Array.from(skillModalContent.querySelectorAll('li'));
                        const clickedIndex = allListItems.indexOf(listItem);
                        const currentGroup = config.timestamps.find(g => g.targetSelector.includes(currentlyDisplayedModalTarget));

                        if (currentGroup && currentGroup.timings[clickedIndex]) {
                            audio.currentTime = currentGroup.timings[clickedIndex].start;
                            if(audio.paused) audio.play();
                        }
                    }
                });
            }

            function syncHighlight(currentTime) {
                const sentences = document.querySelectorAll('.pulled-folder-text span');
                sentences.forEach(sentence => {
                    const start = parseFloat(sentence.dataset.start);
                    const end = parseFloat(sentence.dataset.end);
                    if (currentTime >= start && currentTime < end) {
                        sentence.classList.add('highlight-sentence');
                    } else {
                        sentence.classList.remove('highlight-sentence');
                    }
                });
            }

            function closeFolder(folder) {
                document.body.classList.remove('folder-is-expanded-globally');
                
                if (!folder) return;

                cabinet.style.transform = `translateY(0px)`;
                
                cabinet.classList.remove('folder-is-expanded');
                folder.classList.remove('is-expanded');
                currentlyOpenFolder = null;

                allFolders.forEach(f => {
                    f.classList.remove('move-up', 'move-down');
                });

                // Stop all audios
                const allAudioIds = ['about-me-audio', 'experiences-audio', 'personality-audio', 'skills-audio', 'what-ive-done-audio'];
                allAudioIds.forEach(id => {
                    const audio = document.getElementById(id);
                    if (audio) {
                        audio.pause();
                        audio.currentTime = 0;
                        // Remove all listeners to prevent memory leaks
                        const newAudio = audio.cloneNode(true); // This clones the element and its attributes, but not listeners
                        audio.parentNode.replaceChild(newAudio, audio);
                    }
                });

                skillModal.style.display = 'none';
                skillModal.classList.remove('is-visible');
                currentlyDisplayedModalTarget = null;
                currentActiveAudio = null;
            }

            fileStack.addEventListener('click', (event) => {
                const folder = event.target.closest('.file-folder');
                if (!folder) return;

                const folderId = parseInt(folder.dataset.id);
                if (!allowedTabIds.includes(folderId)) {
                    return; // Ignore click if folder doesn't have a tab
                }

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