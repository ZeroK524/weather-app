// Khởi tạo Lucide icons
lucide.createIcons();
// ====================================================================
// KHÓA API
const API_KEY = '5174a4c980abc22f0dc589db984742cf';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const LANG = 'vi'; // Ngôn ngữ tiếng Việt
// ====================================================================

// --- DOM Elements ---
const cityInput = document.getElementById('city-input');
const searchButton = document.getElementById('search-button');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const statusMessageDiv = document.getElementById('status-message');
const loadingSpinner = document.getElementById('loading-spinner');
const messageText = document.getElementById('message-text');
const currentDetailsCard = document.getElementById('current-details-card');
const forecastGrid = document.getElementById('forecast-grid');
const forecastPlaceholder = document.getElementById('forecast-placeholder');
const extendedDetailsCard = document.getElementById('extended-details-card');
const historyListDropdown = document.getElementById('history-list-dropdown');
const menuButton = document.getElementById('menu-button');
const mobileMenu = document.getElementById('mobile-menu-dropdown');
// Đối tượng chứa toàn bộ dữ liệu dự báo đã xử lý
let processedForecastData = {};
let currentCityLat = null;
let currentCityLon = null;

// --- Utility Functions ---

// Chuyển đổi Kelvin sang Celsius
const kelvinToCelsius = (k) => (k - 273.15).toFixed(0);

// Định dạng thời gian Unix sang định dạng giờ:phút
const formatTime = (unixTime, timezone) => {
    const date = new Date((unixTime + timezone) * 1000);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
};

// Định dạng thời gian Unix sang định dạng đầy đủ
const formatDateTime = (unixTime, timezone) => {
    const date = new Date((unixTime + timezone) * 1000);
    const options = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('vi-VN', options);
};

// Lấy tên ngày trong tuần từ dt_txt
const getDayName = (dt_txt) => {
    const date = new Date(dt_txt);
    return date.toLocaleDateString('vi-VN', { weekday: 'short' });
};

// --- State Management ---

const showStatus = (type, text) => {
    currentDetailsCard.classList.add('hidden');
    extendedDetailsCard.classList.add('hidden');
    statusMessageDiv.classList.remove('hidden');
    messageText.textContent = text;

    if (type === 'loading') {
        loadingSpinner.classList.remove('hidden');
        messageText.classList.remove('text-red-500');
    } else if (type === 'error') {
        loadingSpinner.classList.add('hidden');
        messageText.classList.add('text-red-500');
    } else { // info
        loadingSpinner.classList.add('hidden');
        messageText.classList.remove('text-red-500');
    }
};

const hideStatus = () => {
    statusMessageDiv.classList.add('hidden');
};

// --- Dark Mode Logic ---

const toggleDarkMode = () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeIcon.dataset.lucide = isDark ? 'moon' : 'sun';
    // Tải lại icon sau khi thay đổi data-lucide
    lucide.createIcons();
};

const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        themeIcon.dataset.lucide = 'moon';
    } else {
        themeIcon.dataset.lucide = 'sun';
    }
};

// --- Search History Logic ---

const saveToHistory = (city) => {
    let history = JSON.parse(localStorage.getItem('weatherHistory') || '[]');
    // Xóa mục nhập cũ (nếu có) và thêm mục nhập mới lên đầu
    history = history.filter(h => h.toLowerCase() !== city.toLowerCase());
    history.unshift(city);
    // Giới hạn 5 mục gần nhất
    localStorage.setItem('weatherHistory', JSON.stringify(history.slice(0, 5)));
    renderHistoryDropdown();
};

const renderHistoryDropdown = () => {
    const history = JSON.parse(localStorage.getItem('weatherHistory') || '[]');
    historyListDropdown.innerHTML = '';

    if (history.length === 0) {
        historyListDropdown.classList.add('hidden');
        return;
    }

    history.forEach(city => {
        const li = document.createElement('li');
        li.className = 'p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700 text-black dark:text-black transition text-sm flex justify-between items-center';
        li.textContent = city;
        li.dataset.city = city;

        // Nút xóa
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-gray-400 hover:text-red-500 p-1 rounded-full';
        deleteBtn.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Ngăn sự kiện click lan truyền lên li
            removeFromHistory(city);
        };

        li.appendChild(deleteBtn);
        historyListDropdown.appendChild(li);
    });

    // Re-render Lucide icons for the new elements
    lucide.createIcons();
};

const removeFromHistory = (cityToRemove) => {
    let history = JSON.parse(localStorage.getItem('weatherHistory') || '[]');
    history = history.filter(h => h.toLowerCase() !== cityToRemove.toLowerCase());
    localStorage.setItem('weatherHistory', JSON.stringify(history));
    renderHistoryDropdown();
};


// --- Data Fetching ---

const fetchWeatherData = async (city) => {
    if (API_KEY === null) {
        showStatus('error', 'Vui lòng thay nhập API_KEY bằng Khóa API OpenWeatherMap của bạn.');
        return;
    }
    if (!city) {
        showStatus('error', 'Vui lòng nhập tên thành phố.');
        return;
    }

    showStatus('loading', 'Đang tải dữ liệu thời tiết...');

    try {
        // 1. Lấy dữ liệu thời tiết hiện tại
        const currentUrl = `${BASE_URL}/weather?q=${city}&appid=${API_KEY}&lang=${LANG}`;
        const currentResponse = await fetch(currentUrl);

        if (!currentResponse.ok) {
            const errorData = await currentResponse.json();
            throw new Error(`Lỗi: ${errorData.message} (Không tìm thấy thành phố "${city}")`);
        }

        const currentData = await currentResponse.json();

        // Cập nhật tọa độ cho các API phụ
        currentCityLat = currentData.coord.lat;
        currentCityLon = currentData.coord.lon;

        // 2. Lấy dữ liệu dự báo 5 ngày / 3 giờ
        const forecastUrl = `${BASE_URL}/forecast?q=${city}&appid=${API_KEY}&lang=${LANG}`;
        const forecastResponse = await fetch(forecastUrl);

        if (!forecastResponse.ok) throw new Error("Không thể lấy dữ liệu dự báo 5 ngày.");
        const forecastData = await forecastResponse.json();

        // 3. Xử lý và Hiển thị
        hideStatus();
        saveToHistory(city);

        renderCurrentWeather(currentData);
        processAndRenderForecast(forecastData, currentData.sys.sunrise, currentData.sys.sunset);

        // Mặc định chọn ngày đầu tiên (hôm nay) để hiển thị chi tiết mở rộng
        if (processedForecastData.daily && processedForecastData.daily[0]) {
            renderExtendedDetails(processedForecastData.daily[0], true);
        }


    } catch (error) {
        console.error("Lỗi khi fetch dữ liệu thời tiết:", error);
        showStatus('error', error.message || "Đã xảy ra lỗi không xác định khi lấy dữ liệu thời tiết.");
        // Ẩn các khu vực hiển thị nếu có lỗi
        currentDetailsCard.classList.add('hidden');
        forecastGrid.innerHTML = `<p class="text-center text-red-500 p-4 col-span-5">${error.message}</p>`;
    } finally {
        cityInput.value = ''; // Xóa input sau khi tìm kiếm thành công hoặc thất bại
        historyListDropdown.classList.add('hidden');
    }
};

// --- Data Processing ---

const processAndRenderForecast = (forecastData, sunrise, sunset) => {
    const dailyData = {}; // Lưu trữ dữ liệu min/max/pop cho mỗi ngày

    forecastData.list.forEach(item => {
        const dateKey = item.dt_txt.split(' ')[0]; // YYYY-MM-DD
        const tempC = parseFloat(kelvinToCelsius(item.main.temp));

        if (!dailyData[dateKey]) {
            // Khởi tạo ngày mới
            dailyData[dateKey] = {
                dt_txt: item.dt_txt,
                dayName: getDayName(item.dt_txt),
                date: dateKey,
                minTemp: tempC,
                maxTemp: tempC,
                icon: item.weather[0].icon,
                description: item.weather[0].description,
                pop: item.pop * 100, // Probability of Precipitation (POP)
                intervals: []
            };
        } else {
            // Cập nhật min/max
            dailyData[dateKey].minTemp = Math.min(dailyData[dateKey].minTemp, tempC);
            dailyData[dateKey].maxTemp = Math.max(dailyData[dateKey].maxTemp, tempC);

            // Cập nhật icon và mô tả gần trưa (12:00:00) cho đại diện
            if (item.dt_txt.includes('12:00:00')) {
                dailyData[dateKey].icon = item.weather[0].icon;
                dailyData[dateKey].description = item.weather[0].description;
            }

            // Lấy POP cao nhất trong ngày
            dailyData[dateKey].pop = Math.max(dailyData[dateKey].pop, item.pop * 100);
        }
        dailyData[dateKey].intervals.push(item);
    });

    // Gán dữ liệu đã xử lý vào biến toàn cục và thêm sunrise/sunset
    processedForecastData = {
        city: forecastData.city.name,
        daily: Object.values(dailyData),
        sunrise: sunrise,
        sunset: sunset
    };

    renderForecastGrid(processedForecastData.daily.slice(0, 5));
};

// --- Rendering Functions ---

const renderCurrentWeather = (data) => {
    const tempC = kelvinToCelsius(data.main.temp);
    const descriptionVN = data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1);
    const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    const visibilityKm = (data.visibility / 1000).toFixed(1);

    document.getElementById('current-city-name').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('current-temp').textContent = `${tempC}°C`;
    document.getElementById('current-condition').textContent = descriptionVN;
    document.getElementById('current-icon').src = iconUrl;
    document.getElementById('current-date-time').textContent = formatDateTime(data.dt, data.timezone);

    document.getElementById('humidity-value').textContent = `${data.main.humidity}%`;
    document.getElementById('wind-speed-value').textContent = `${(data.wind.speed * 3.6).toFixed(1)} km/h`;
    document.getElementById('pressure-value').textContent = `${data.main.pressure} hPa`;
    document.getElementById('visibility-value').textContent = `${visibilityKm} km`;

    currentDetailsCard.classList.remove('hidden');
    lucide.createIcons();
};

const renderForecastGrid = (dailyForecasts) => {
    forecastGrid.innerHTML = ''; // Xóa placeholder/nội dung cũ

    dailyForecasts.forEach((dayData, index) => {
        const iconUrl = `https://openweathermap.org/img/wn/${dayData.icon}.png`;
        const dayLabel = index === 0 ? 'Hôm nay' : dayData.dayName;

        const itemHTML = `
    <div class="forecast-item card p-3 text-center cursor-pointer transition transform duration-200 ${index === 0 ? 'selected' : ''}" data-day-index="${index}">
        <p class="font-semibold text-sm">${dayLabel}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">${dayData.date.slice(5).replace('-', '/')}</p>
        <img src="${iconUrl}" alt="${dayData.description}" class="w-14 h-14 mx-auto">
            <p class="text-lg font-bold text-red-600">${dayData.maxTemp}°</p>
            <p class="text-xs text-blue-600">${dayData.minTemp}°</p>
            <p class="text-xs text-gray-500 capitalize mt-1">${dayData.description}</p>
    </div>
    `;
        forecastGrid.insertAdjacentHTML('beforeend', itemHTML);
    });

    // Gắn sự kiện click vào các thẻ dự báo
    document.querySelectorAll('.forecast-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Xóa trạng thái selected khỏi tất cả các item
            document.querySelectorAll('.forecast-item').forEach(el => el.classList.remove('selected'));

            // Thêm trạng thái selected vào item hiện tại
            e.currentTarget.classList.add('selected');

            const index = parseInt(e.currentTarget.dataset.dayIndex);
            renderExtendedDetails(processedForecastData.daily[index], index === 0);
        });
    });
};

const renderExtendedDetails = (dayData, isToday) => {
    document.getElementById('extended-details-title').textContent = isToday
        ? `Chi Tiết Thời Tiết Hôm Nay (${dayData.date.slice(5).replace('-', '/')})`
        : `Chi Tiết Thời Tiết Ngày ${dayData.dayName} (${dayData.date.slice(5).replace('-', '/')})`;

    document.getElementById('max-temp-detail').textContent = `${dayData.maxTemp}°C`;
    document.getElementById('min-temp-detail').textContent = `${dayData.minTemp}°C`;
    document.getElementById('pop-detail').textContent = `${dayData.pop.toFixed(0)}%`;

    const timezone = dayData.intervals[0].timezone || processedForecastData.intervals?.[0]?.timezone || 25200; // Default to GMT+7
    document.getElementById('sunrise-detail').textContent = formatTime(processedForecastData.sunrise, timezone);
    document.getElementById('sunset-detail').textContent = formatTime(processedForecastData.sunset, timezone);

    const uvEstimate = Math.min(10, (dayData.maxTemp / 10) + (dayData.pop / 50)); // Rất tối giản
    document.getElementById('uv-detail').textContent = `${uvEstimate.toFixed(1)}`;

    extendedDetailsCard.classList.remove('hidden');
};

// --- Event Listeners ---

// Xử lý tìm kiếm
const handleSearch = () => {
    const city = cityInput.value.trim();
    if (city) {
        fetchWeatherData(city);
    } else {
        showStatus('error', 'Vui lòng nhập tên thành phố hợp lệ.');
    }
};

searchButton.addEventListener('click', handleSearch);

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

// Xử lý Dark Mode
themeToggle.addEventListener('click', toggleDarkMode);

// Xử lý Dropdown Lịch sử Tìm kiếm
cityInput.addEventListener('focus', () => {
    const history = JSON.parse(localStorage.getItem('weatherHistory') || '[]');
    if (history.length > 0) {
        historyListDropdown.classList.remove('hidden');
    }
});

// Ẩn dropdown khi click ra ngoài
document.addEventListener('click', (e) => {
    if (!historyListDropdown.contains(e.target) && e.target !== cityInput && e.target !== searchButton) {
        historyListDropdown.classList.add('hidden');
    }
});

// Xử lý click vào Lịch sử
historyListDropdown.addEventListener('click', (e) => {
    const city = e.target.closest('li')?.dataset.city;
    if (city) {
        cityInput.value = city; // Đặt giá trị vào input
        fetchWeatherData(city);
    }
});


// --- Initial Load ---
window.onload = () => {
    loadTheme();
    lucide.createIcons(); // Khởi tạo tất cả icon Lucide
    renderHistoryDropdown();

    // Tải dữ liệu mặc định khi khởi động (ví dụ: Nha Trang)
    cityInput.value = 'Nha Trang';
    fetchWeatherData('Nha Trang');
};

menuButton.addEventListener('click', () => {
    // Toggle (bật/tắt) lớp 'hidden'
    mobileMenu.classList.toggle('hidden');
    if (!mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('flex');
    } else {
        mobileMenu.classList.remove('flex');
    }
});

