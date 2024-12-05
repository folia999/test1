/**
 * 
 * 這個模組負責控制多個 YouTube 播放器的同步播放、音量控制和全螢幕功能
 * 包含一個主播放器（左側）和三個直播播放器（右側）
 * 
 * 主要功能：
 * - 同步播放/暫停控制
 * - 統一音量控制
 * - 靜音切換
 * - 全螢幕切換
 * - 鍵盤快捷鍵
 */

// 全域狀態管理物件
const state = {
    players: [],          
    rightPlayers: [],     // 新增：儲存右側播放器的參考
    mainPlayer: null,     // 新增：儲存主播放器的參考
    isPlaying: false,     
    isMuted: false,       
    currentVolume: 100,   
    volumeBeforeMute: 100 
};

/**
 * YouTube API 準備就緒時的回調函數
 * 這個函數會在 YouTube IFrame API 載入完成後自動調用
 */
window.onYouTubeIframeAPIReady = function() {
    // 初始化主播放器（左側影片）
    new YT.Player('youtube-player', {
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });

    // 初始化右側三個直播播放器
    ['right-player-1', 'right-player-2', 'right-player-3'].forEach(id => {
        new YT.Player(id, {
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    });
}

/**
 * 播放器準備就緒的回調函數
 * @param {Object} event - YouTube 播放器事件對象
 */
function onPlayerReady(event) {
    try {
        const player = event.target;
        state.players.push(player);
        
        const elementId = player.getIframe().id;
        if (elementId === 'youtube-player') {
            state.mainPlayer = player;
            player.setVolume(100);
        } else {
            state.rightPlayers.push(player);
            player.setVolume(1);
        }
        
        player.unMute();

        if (state.players.length === 4) {
            setupControls();
            const volumeSlider = document.getElementById('volumeSlider');
            if (volumeSlider) {
                volumeSlider.style.width = '100%';
            }
        }
    } catch (error) {
        handleError(error);
    }
}

/**
 * 播放器狀態變更的回調函數
 * @param {Object} event - YouTube 播放器事件對象
 */
function onPlayerStateChange(event) {
    const playPauseBtn = document.getElementById('playPauseBtn');
    
    if (event.data === YT.PlayerState.PLAYING) {
        state.isPlaying = true;
        playPauseBtn.textContent = '⏸';
        // 同步其他播放器的播放狀態
        syncPlayState(true);
    } else if (event.data === YT.PlayerState.PAUSED) {
        state.isPlaying = false;
        playPauseBtn.textContent = '▶';
        // 同步其他播放器的暫停狀態
        syncPlayState(false);
    }
}

/**
 * 同步所有播放器的播放狀態
 * @param {boolean} shouldPlay - 是否應該播放
 */
function syncPlayState(shouldPlay) {
    state.players.forEach(player => {
        try {
            if (shouldPlay) {
                player.playVideo();
            } else {
                player.pauseVideo();
            }
        } catch (error) {
            console.error('播放狀態同步錯誤:', error);
        }
    });
}

/**
 * 設置所有控制項的功能
 * 這個函數在所有播放器都準備就緒後調用
 */
function setupControls() {
    if (!checkPlayerState()) return;
    
    const elements = {
        playPauseBtn: document.getElementById('playPauseBtn'),
        muteBtn: document.getElementById('muteBtn'),
        volumeSlider: document.getElementById('volumeSlider'),
        volumeBar: document.querySelector('.volume-bar'),
        fullscreenBtn: document.getElementById('fullscreenBtn')
    };

    // 確保所有元素都存在
    if (!Object.values(elements).every(el => el)) {
        console.error('Some control elements are missing');
        return;
    }

    setupPlayPauseControl(elements.playPauseBtn);
    setupVolumeControl(elements.volumeBar, elements.volumeSlider, elements.muteBtn);
    setupFullscreenControl(elements.fullscreenBtn);
    setupKeyboardControls(elements);
}

/**
 * 設置播放/暫停控制
 * @param {HTMLElement} playPauseBtn - 播放/暫停按鈕元素
 */
function setupPlayPauseControl(playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        // 切換播放狀態
        state.isPlaying = !state.isPlaying;
        // 更新按鈕圖示
        playPauseBtn.textContent = state.isPlaying ? '⏸' : '▶';
        // 同步所有播放器的狀態
        syncPlayState(state.isPlaying);
    });
}

/**
 * 設置音量控制
 * 包含音量滑塊和靜音按鈕的功能
 */
function setupVolumeControl(volumeBar, volumeSlider, muteBtn) {
    let isDragging = false;

    /**
     * 更新音量的核心函數
     * @param {number} volume - 目標音量（0-100）
     */
    function updateVolume(volume) {
        state.currentVolume = Math.max(0, Math.min(100, volume));
        
        // 更新音量滑塊顯示
        volumeSlider.style.width = `${state.currentVolume}%`;
        
        // 只更新主播放器的音量
        if (state.mainPlayer) {
            state.mainPlayer.setVolume(state.currentVolume);
            
            if (state.currentVolume === 0) {
                state.mainPlayer.mute();
                muteBtn.classList.add('muted');
                state.isMuted = true;
            } else if (state.isMuted) {
                state.mainPlayer.unMute();
                muteBtn.classList.remove('muted');
                state.isMuted = false;
            }
        }
        
        localStorage.setItem('playerVolume', state.currentVolume);
    }

    /**
     * 音量拖曳處理函數
     */
    function handleVolumeDrag(e) {
        if (!isDragging) return;
        
        const rect = volumeBar.getBoundingClientRect();
        const volume = ((e.clientX - rect.left) / rect.width) * 100;
        updateVolume(volume);
    }

    // 設置音量條的點擊和拖曳事件
    volumeBar.addEventListener('mousedown', e => {
        isDragging = true;
        handleVolumeDrag(e);
        
        // 添加拖曳相關的事件監聽
        document.addEventListener('mousemove', handleVolumeDrag);
        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.removeEventListener('mousemove', handleVolumeDrag);
        }, { once: true });
    });

    // 設置靜音按鈕功能
    muteBtn.addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        
        if (state.isMuted) {
            state.volumeBeforeMute = state.currentVolume;
            volumeSlider.style.width = '0%';
            muteBtn.classList.add('muted');
            // 所有播放器都靜音
            state.players.forEach(player => player.mute());
        } else {
            volumeSlider.style.width = `${state.volumeBeforeMute}%`;
            state.currentVolume = state.volumeBeforeMute;
            muteBtn.classList.remove('muted');
            // 所有播放器都取消靜音，但保持各自的音量設定
            state.players.forEach(player => {
                player.unMute();
                if (player === state.mainPlayer) {
                    player.setVolume(state.currentVolume);
                } else {
                    player.setVolume(1);  // 右側播放器保持音量為 1
                }
            });
        }
    });
}

/**
 * 設置全螢幕控制
 * @param {HTMLElement} fullscreenBtn - 全螢幕按鈕元素
 */
function setupFullscreenControl(fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
        const container = document.querySelector('.video-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.error('全螢幕模式錯誤:', err);
            });
        } else {
            document.exitFullscreen();
        }
    });
}

/**
 * 設置鍵盤快捷鍵
 * 支援的快捷鍵：
 * - 空格：播放/暫停
 * - M：靜音切換
 * - 上下箭頭：調整音量
 * - Enter：全螢幕切換
 */
function setupKeyboardControls(elements) {
    const VOLUME_STEP = 5;  // 音量調整的步進值

    document.addEventListener('keydown', (e) => {
        // 忽略輸入框中的鍵盤事件
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.code) {
            case 'Space':  // 播放/暫停
                e.preventDefault();
                elements.playPauseBtn.click();
                break;
            case 'KeyM':   // 靜音切換
                e.preventDefault();
                elements.muteBtn.click();
                break;
            case 'ArrowUp':    // 增加音量
                e.preventDefault();
                updateVolume(state.currentVolume + VOLUME_STEP);
                break;
            case 'ArrowDown':  // 降低音量
                e.preventDefault();
                updateVolume(state.currentVolume - VOLUME_STEP);
                break;
            case 'Enter':      // 全螢幕切換
                e.preventDefault();
                elements.fullscreenBtn.click();
                break;
        }
    });
}

// 修改 API 載入方式
function loadYouTubeAPI() {
    if (typeof YT === 'undefined') {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
}

// 確保 DOM 完全載入後再載入 API
document.addEventListener('DOMContentLoaded', loadYouTubeAPI);

// 添加錯誤處理函數
function handleError(error) {
    console.error('YouTube Player Error:', error);
    // 可以在這裡添加重試邏輯
    retryInitialization();
}

// 添加重試機制
let retryCount = 0;
const MAX_RETRIES = 3;

function retryInitialization() {
    if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying initialization... Attempt ${retryCount}`);
        setTimeout(loadYouTubeAPI, 1000 * retryCount);
    }
}

// 添加狀態檢查函數
function checkPlayerState() {
    if (!state.mainPlayer || state.rightPlayers.length !== 3) {
        console.warn('Players not fully initialized, retrying...');
        retryInitialization();
        return false;
    }
    return true;
}
