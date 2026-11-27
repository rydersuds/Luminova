/* Russian translation, tied to the theme: light mode = Russian, dark mode = English.
 *
 * The pages are written in English. In Russian mode every text node and a few attributes
 * (placeholder, aria-label, title, alt) are looked up in RU below, by their English text.
 * Text that is built on the fly (booking steps, admin messages, server replies) is
 * caught by a MutationObserver and translated the same way; PATTERNS handle text with
 * names, dates, times and prices in it. Switching back restores the original English.
 * The switch is the #theme-toggle checkbox (checked = dark = English); pages without it
 * follow the theme saved in this browser (no saved theme = dark = English).
 */
(function () {
  'use strict';

  var WD = { Monday: 'понедельник', Tuesday: 'вторник', Wednesday: 'среда', Thursday: 'четверг', Friday: 'пятница', Saturday: 'суббота', Sunday: 'воскресенье' };
  var MO = { January: 'января', February: 'февраля', March: 'марта', April: 'апреля', May: 'мая', June: 'июня', July: 'июля', August: 'августа', September: 'сентября', October: 'октября', November: 'ноября', December: 'декабря' };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  var RU = {
    // ----- Page titles and meta -----
    'Massage Fenix — Registered Massage Therapy in Calgary': 'Massage Fenix — профессиональный массаж в Калгари',
    'Registered massage therapy in McKenzie Towne, Calgary. Therapeutic, deep tissue, sports, hot stone, bamboo, reflexology and cupping massage with Felix Etin, RMT. Book online.': 'Профессиональный массаж в Маккензи-Таун, Калгари. Лечебный, глубокий, спортивный массаж, стоун-терапия, бамбуковый массаж, рефлексотерапия и баночный массаж у Феликса Этина, RMT. Онлайн-запись.',
    'Staff login — Massage Fenix': 'Вход для сотрудников — Massage Fenix',
    'Admin — Massage Fenix': 'Администрирование — Massage Fenix',

    // ----- Header, navigation, general -----
    'Skip to content': 'Перейти к содержанию',
    'By appointment · Calgary, AB': 'По предварительной записи · Калгари, Альберта',
    'Massage Fenix home': 'Massage Fenix — на главную',
    'Services': 'Услуги',
    'Pricing': 'Цены',
    'About': 'О нас',
    'Book': 'Запись',
    'Contact': 'Контакты',
    'Dark mode': 'Тёмная тема',
    'Switch between light and dark mode': 'Переключить светлую и тёмную тему',
    'Call to book': 'Звоните для записи',
    'Book now': 'Записаться',
    'Open menu': 'Открыть меню',
    'Close menu': 'Закрыть меню',

    // ----- Hero -----
    'Calgary, Alberta · McKenzie Towne': 'Калгари, Альберта · Маккензи-Таун',
    'Renew your body.': 'Обновите тело.',
    'Restore': 'Восстановите',
    'your balance.': 'равновесие.',
    'Massage Fenix is a registered massage therapy practice built on one idea: every session should leave you feeling restored, from the inside out. Led by Felix Etin, RMT.': 'Massage Fenix — кабинет профессионального массажа, созданный ради одной цели: после каждого сеанса вы должны чувствовать себя обновлённым — изнутри и снаружи. Ведёт приём Феликс Этин, дипломированный массажист (RMT).',
    'Book an appointment': 'Записаться на приём',
    'View services': 'Посмотреть услуги',
    'Highlights': 'Главное',
    'years of practice': 'лет практики',
    'massage types': 'видов массажа',
    'Open today': 'Сегодня открыто',
    'Closed today': 'Сегодня закрыто',
    'Closed': 'Выходной',

    // ----- Services -----
    'Find the right massage for your body': 'Подберите массаж, который нужен вашему телу',
    'Not sure which to choose? Add a note when you book and Felix will tailor the session.': 'Не знаете, что выбрать? Оставьте комментарий при записи, и Феликс подстроит сеанс под вас.',
    'Filter services': 'Фильтр услуг',
    'All': 'Все',
    'Pain & recovery': 'Боль и восстановление',
    'Relaxation': 'Расслабление',
    'Specialty': 'Особые техники',
    'From': 'от',
    'Book this': 'Записаться',
    'Therapeutic massage': 'Лечебный массаж',
    'Deep tissue massage': 'Глубокий массаж тканей',
    'Sport massage': 'Спортивный массаж',
    'Cupping (vacuum)': 'Баночный (вакуумный) массаж',
    'Relaxation massage': 'Расслабляющий массаж',
    'Pregnancy massage': 'Массаж для беременных',
    'Aromatherapy massage': 'Аромамассаж',
    'Hot & cold stone': 'Горячие и холодные камни',
    'Bamboo massage': 'Бамбуковый массаж',
    'Reflexology': 'Рефлексотерапия',
    'Anti-cellulite massage': 'Антицеллюлитный массаж',
    'Focused treatment for muscle tension, stiffness and chronic pain, adjusted to your history and goals.': 'Прицельная работа с мышечным напряжением, скованностью и хронической болью с учётом вашей истории и целей.',
    'Slow, firm pressure that reaches deeper layers of muscle and fascia to release long-held knots.': 'Медленное, сильное давление, которое достигает глубоких слоёв мышц и фасций и снимает застарелые зажимы.',
    'Pre- and post-event work and injury rehab, informed by years with athletes and sports teams.': 'Подготовка к соревнованиям, восстановление после них и реабилитация после травм — опыт многолетней работы со спортсменами и командами.',
    'Cups create gentle negative pressure on trigger points, lifting tissue and drawing in blood flow.': 'Банки создают мягкое вакуумное воздействие на триггерные точки, приподнимают ткани и усиливают кровоток.',
    'Long, flowing strokes that calm the nervous system, ease stress and improve circulation.': 'Длинные плавные движения успокаивают нервную систему, снимают стресс и улучшают кровообращение.',
    'Gentle, well-supported massage for comfort through pregnancy and recovery after birth.': 'Бережный массаж в удобном положении для комфорта во время беременности и восстановления после родов.',
    'Soothing massage with essential oils chosen to calm, uplift or ease tension.': 'Мягкий массаж с эфирными маслами, подобранными, чтобы успокоить, взбодрить или снять напряжение.',
    'Heated and chilled stones warm muscles, reduce inflammation and deepen relaxation.': 'Нагретые и охлаждённые камни прогревают мышцы, уменьшают воспаление и усиливают расслабление.',
    'Warm bamboo tools roll and knead tissue for a deeply relaxing, even pressure.': 'Тёплые бамбуковые палочки прокатывают и разминают ткани — глубокое расслабление и равномерное давление.',
    'Targeted pressure on points in the feet to boost circulation and support whole-body balance.': 'Точечное воздействие на зоны стоп улучшает кровообращение и помогает балансу всего организма.',
    'Brisk, targeted techniques that stimulate circulation and lymph flow to smooth and tone the skin.': 'Интенсивные прицельные техники стимулируют кровообращение и лимфоток, выравнивают и подтягивают кожу.',
    'Therapeutic massage with focused pressure on a client’s shoulder blade': 'Лечебный массаж: прицельное давление на область лопатки',
    'Deep tissue massage with firm thumb pressure into a client’s back muscles': 'Глубокий массаж: сильное давление большими пальцами на мышцы спины',
    'Sport massage with firm pressure on a client’s hamstring': 'Спортивный массаж задней поверхности бедра',
    'Cupping therapy with glass cups on a client’s back': 'Баночный массаж: стеклянные банки на спине',
    'Relaxation massage with gentle hands easing tension in a client’s neck and shoulders': 'Расслабляющий массаж шеи и плеч',
    'Pregnancy massage, with the client comfortably supported under soft towels': 'Массаж для беременных в удобном положении под мягкими полотенцами',
    'Aromatherapy massage with warm oil on a client’s back': 'Аромамассаж спины с тёплым маслом',
    'Warm, steaming massage stones placed along a client’s back': 'Тёплые массажные камни вдоль спины',
    'Bamboo massage with warm bamboo sticks along a client’s back': 'Массаж спины тёплыми бамбуковыми палочками',
    'Reflexology on the sole of a client’s foot': 'Рефлексотерапия: массаж стопы',
    'Anti-cellulite massage with a gliding silicone suction cup': 'Антицеллюлитный массаж силиконовой вакуумной банкой',

    // ----- Pricing -----
    'Simple, transparent rates': 'Простые и понятные цены',
    'Every massage is priced by session length. Tap any price to book it.': 'Стоимость зависит от длительности сеанса. Нажмите на цену, чтобы записаться.',
    'Massage prices by session length': 'Цены на массаж по длительности сеанса',
    'Massage': 'Массаж',
    '· minutes': '· минуты',
    'min': 'мин',
    'Not offered': 'Не предлагается',
    'Special offers': 'Спецпредложения',
    'Specials': 'Спецпредложения',
    '10% off': 'Скидка 10%',
    'Your first session as a new client, any massage. Just tick "first visit" when you book.': 'На первый сеанс для новых клиентов, любой массаж. Просто отметьте «первый визит» при записи.',
    '5 for $600': '5 сеансов за $600',
    'less 10%': 'минус 10%',
    'A package of five therapeutic massages. Please call': 'Пакет из пяти лечебных массажей. Для записи звоните по номеру',
    'to book it.': '.',

    // ----- About -----
    'About Felix Etin, RMT': 'О Феликсе Этине, RMT',
    'Clinical experience, delivered with a calm touch.': 'Клинический опыт и спокойные, уверенные руки.',
    'Felix Etin, registered massage therapist at Massage Fenix': 'Феликс Этин, дипломированный массажист Massage Fenix',
    'Felix Etin, RMT': 'Феликс Этин, RMT',
    'Massage Fenix is a small, independent studio in McKenzie Towne. Felix brings more than three decades of hands-on experience from sports centres, hospitals, rehabilitation clinics, professional sports teams and spas.': 'Massage Fenix — небольшая независимая студия в Маккензи-Таун. За плечами Феликса более тридцати лет практики в спортивных центрах, больницах, реабилитационных клиниках, профессиональных спортивных командах и спа.',
    'That background means every session starts with understanding': 'Поэтому каждый сеанс начинается с того, чтобы понять,',
    'why': 'почему',
    'you\'re sore, then choosing the techniques that will actually help, whether that\'s recovering from an injury, managing chronic tension or simply switching off for an hour.': 'у вас болит, а затем подобрать техники, которые действительно помогут: восстановиться после травмы, справиться с хроническим напряжением или просто отключиться на час.',
    'Registered massage therapist': 'Дипломированный массажист',
    '30+ years hands-on experience': 'Более 30 лет практики',
    'Sessions tailored to your needs': 'Сеансы под ваши потребности',
    'Weekday evening & weekend hours': 'Вечерние часы в будни и приём в выходные',

    // ----- Book band, contact, footer -----
    'Book online': 'Онлайн-запись',
    'Ready when you are': 'Ждём вас, когда вам удобно',
    'Choose a service and a time in under a minute. You\'ll get a confirmation number right away.': 'Выберите услугу и время меньше чем за минуту. Номер подтверждения вы получите сразу.',
    'Start booking': 'Начать запись',
    'or call 403 714 9481': 'или позвоните: 403 714 9481',
    'Hours & location': 'Часы работы и адрес',
    'Visit us in McKenzie Towne': 'Ждём вас в Маккензи-Таун',
    'Opening hours': 'Часы работы',
    'By appointment. Hours may change without notice; please call to confirm holiday hours.': 'По предварительной записи. Часы работы могут меняться; в праздники, пожалуйста, уточняйте по телефону.',
    'Get directions': 'Как добраться',
    'Map to Massage Fenix, 70 Elgin Meadows Way SE, Calgary': 'Карта: Massage Fenix, 70 Elgin Meadows Way SE, Калгари',
    'Registered massage therapy': 'Профессиональный массаж',
    '70 Elgin Meadows Way SE, Calgary ·': '70 Elgin Meadows Way SE, Калгари ·',
    'Staff login': 'Вход для сотрудников',
    'Massage Fenix. All rights reserved.': 'Massage Fenix. Все права защищены.',

    // ----- Booking panel -----
    'Close booking': 'Закрыть запись',
    'Booking steps': 'Этапы записи',
    'Service': 'Услуга',
    'Date & time': 'Дата и время',
    'Your details': 'Ваши данные',
    'Choose a service': 'Выберите услугу',
    'Loading services…': 'Загружаем услуги…',
    'Session length': 'Длительность сеанса',
    'Package booking': 'Запись на пакет',
    'Booking the 5-massage package?': 'Хотите пакет из 5 массажей?',
    'Five therapeutic massages for $600, less 10%. Please call us to book the package.': 'Пять лечебных массажей за $600 минус 10%. Чтобы записаться на пакет, позвоните нам.',
    'Call 403 714 9481': 'Позвонить: 403 714 9481',
    'Continue': 'Далее',
    'Back': 'Назад',
    'Choose a date': 'Выберите дату',
    'Or pick another date': 'Или выберите другую дату',
    'Available times': 'Свободное время',
    'Today': 'Сегодня',
    'Checking availability…': 'Проверяем свободное время…',
    'No openings on this day. Try another date, or call': 'В этот день свободного времени нет. Выберите другую дату или позвоните по номеру',
    'We couldn\'t load times right now. Please call': 'Не удалось загрузить расписание. Пожалуйста, позвоните по номеру',
    'to book.': 'для записи.',
    'Paid at the studio': 'Оплата в студии',
    'Full name': 'Имя и фамилия',
    'Phone': 'Телефон',
    'Email': 'Эл. почта',
    'Anything we should know?': 'Что нам важно знать?',
    '(optional)': '(необязательно)',
    'Areas of focus, injuries, pregnancy, pressure preference…': 'Проблемные зоны, травмы, беременность, предпочитаемая сила давления…',
    'This is my first visit to Massage Fenix': 'Я впервые в Massage Fenix',
    'New clients get 10% off their first session': 'Новым клиентам — скидка 10% на первый сеанс',
    'Need to cancel or reschedule? Please call': 'Нужно отменить или перенести визит? Позвоните по номеру',
    'at least 24 hours ahead.': 'не менее чем за 24 часа.',
    'Confirm booking': 'Подтвердить запись',
    'Booking…': 'Записываем…',
    'You\'re booked!': 'Вы записаны!',
    'Confirmation': 'Номер подтверждения',
    'Add to calendar': 'Добавить в календарь',
    'Book another': 'Записаться ещё',
    'Online booking needs JavaScript. Please call': 'Для онлайн-записи нужен JavaScript. Пожалуйста, позвоните по номеру',
    'Online booking is unavailable right now. Please call': 'Онлайн-запись сейчас недоступна. Пожалуйста, позвоните по номеру',
    'or email': 'или напишите на',
    'Enter your name.': 'Укажите имя.',
    'Enter a valid phone number.': 'Укажите правильный номер телефона.',
    'Enter a valid email address.': 'Укажите правильный адрес эл. почты.',
    'Something went wrong. Please call 403 714 9481 to book.': 'Что-то пошло не так. Пожалуйста, позвоните для записи: 403 714 9481.',
    'Booking failed.': 'Не удалось записаться.',
    'Request failed': 'Ошибка запроса',
    // replies from the server
    'Please check the highlighted fields.': 'Проверьте отмеченные поля.',
    'Sorry, that time was just taken. Please pick another.': 'Извините, это время только что заняли. Выберите другое.',
    'Too many booking attempts. Please call us instead.': 'Слишком много попыток записи. Пожалуйста, позвоните нам.',
    'Something went wrong. Please call us to book.': 'Что-то пошло не так. Пожалуйста, позвоните нам для записи.',
    'Invalid service, duration or date.': 'Неверная услуга, длительность или дата.',
    'Choose a service.': 'Выберите услугу.',
    'Choose a session length.': 'Выберите длительность сеанса.',
    'Choose a date.': 'Выберите дату.',
    'Choose a time.': 'Выберите время.',
    'Notes must be under 1000 characters.': 'Комментарий должен быть короче 1000 символов.',

    // ----- Staff login -----
    'Massage Fenix website': 'Сайт Massage Fenix',
    'Manage appointments, hours and time off.': 'Записи, часы работы и выходные.',
    'Password': 'Пароль',
    'Log in': 'Войти',
    'Logging in…': 'Входим…',
    '← Back to the website': '← Вернуться на сайт',
    'That password didn’t match. Please try again.': 'Неверный пароль. Попробуйте ещё раз.',
    'Too many attempts. Please wait 15 minutes and try again.': 'Слишком много попыток. Подождите 15 минут и попробуйте снова.',
    'You’re signed out.': 'Вы вышли из системы.',
    'Your password was right, but this browser didn’t keep the login cookie. Please allow cookies for this site (or turn off private browsing or strict tracking protection) and try again.': 'Пароль верный, но браузер не сохранил cookie для входа. Разрешите cookie для этого сайта (или отключите приватный режим и строгую защиту от отслеживания) и попробуйте снова.',
    'Couldn’t log in. Please try again.': 'Не удалось войти. Попробуйте ещё раз.',
    'Couldn’t reach the server. Check your connection and try again.': 'Нет связи с сервером. Проверьте подключение и попробуйте снова.',
    'The staff login is turned off: ADMIN_PASSWORD isn’t set on the server.': 'Вход для сотрудников отключён: на сервере не задан ADMIN_PASSWORD.',
    'Please sign in again.': 'Пожалуйста, войдите снова.',

    // ----- Admin: header and tabs -----
    'Admin': 'Админ',
    'View site': 'На сайт',
    'Log out': 'Выйти',
    'Admin sections': 'Разделы',
    'Appointments': 'Записи',
    'Who\'s coming': 'Кто придёт',
    'Hours': 'Часы работы',
    'Your weekly schedule': 'Ваше расписание',
    'Time off': 'Выходные',
    'Holidays & breaks': 'Праздники и перерывы',
    'Emails': 'Письма',
    'New booking alerts': 'Уведомления о записях',

    // ----- Admin: appointments -----
    'To': 'По',
    'to': 'до',
    'Show': 'Показать',
    'Next 7 days': 'Ближайшие 7 дней',
    'appointments': 'записей',
    'hours booked': 'часов занято',
    'expected': 'ожидается',
    'Time': 'Время',
    'Client': 'Клиент',
    'Notes': 'Комментарий',
    'Cancel': 'Отменить',
    'Cancelled': 'Отменено',
    'First visit −10%': 'Первый визит −10%',
    'No bookings in this range.': 'В этот период записей нет.',
    'Loading…': 'Загрузка…',
    'Remember to let them know.': 'Не забудьте предупредить клиента.',
    'Cancel booking': 'Отменить запись',
    'Keep it': 'Оставить',
    'Confirm': 'Подтвердить',
    'Booking not found or already cancelled.': 'Запись не найдена или уже отменена.',
    'Invalid date range.': 'Неверный период.',

    // ----- Admin: hours -----
    'Your regular weekly hours and booking rules. Changes apply to the booking form as soon as you save.': 'Ваше обычное недельное расписание и правила записи. Изменения применяются к форме записи сразу после сохранения.',
    'Open': 'Открыто',
    'Start times every': 'Начало сеансов каждые',
    'Break between clients': 'Перерыв между клиентами',
    'Minimum notice': 'Минимум заранее',
    'Clients can book up to': 'Запись возможна на',
    'None': 'Нет',
    'hour': 'час',
    '1 hour': '1 час',
    '2 hours': '2 часа',
    '4 hours': '4 часа',
    '12 hours': '12 часов',
    '1 day': '1 день',
    '2 days': '2 дня',
    '10 minutes': '10 минут',
    '15 minutes': '15 минут',
    '20 minutes': '20 минут',
    '30 minutes': '30 минут',
    '45 minutes': '45 минут',
    '2 weeks ahead': '2 недели вперёд',
    '30 days ahead': '30 дней вперёд',
    '60 days ahead': '60 дней вперёд',
    '90 days ahead': '90 дней вперёд',
    '6 months ahead': '6 месяцев вперёд',
    'Save hours': 'Сохранить часы',
    'Reset to defaults': 'Вернуть по умолчанию',
    'Reset to defaults.': 'Возвращено по умолчанию.',
    'Reset hours and booking rules?': 'Сбросить часы и правила записи?',
    'This goes back to the original weekly hours and rules.': 'Будут восстановлены исходные часы работы и правила.',
    'Reset': 'Сбросить',
    'Saved. The booking form now uses these hours.': 'Сохранено. Форма записи уже использует эти часы.',
    'Open at least one day a week.': 'Должен быть открыт хотя бы один день в неделю.',
    'Weekly hours are missing.': 'Не указано недельное расписание.',
    'Start times must be every 15, 20, 30 or 60 minutes.': 'Начало сеансов: каждые 15, 20, 30 или 60 минут.',

    // ----- Admin: time off -----
    'Times you block here won\'t be offered to clients. Use it for holidays, breaks or appointments booked by phone.': 'Заблокированное здесь время не будет предлагаться клиентам. Используйте для праздников, перерывов или записей по телефону.',
    'Take today off': 'Выходной сегодня',
    'Take tomorrow off': 'Выходной завтра',
    'Or block a specific time': 'Или заблокируйте определённое время',
    'Date': 'Дата',
    'Start': 'Начало',
    'End': 'Конец',
    'All day': 'Весь день',
    'Reason': 'Причина',
    'e.g. Phone booking – J. Smith': 'напр. Запись по телефону — И. Иванов',
    'Add block': 'Заблокировать',
    'Blocked.': 'Заблокировано.',
    'Day off': 'Выходной',
    'No upcoming blocks.': 'Нет запланированных блокировок.',
    'Remove': 'Удалить',
    'Block not found.': 'Блокировка не найдена.',
    'Choose a start time before the end time.': 'Время начала должно быть раньше времени окончания.',

    // ----- Admin: emails -----
    'Booking emails': 'Письма о записях',
    'Get an email every time someone books online. The website sends it from an email account you already have.': 'Получайте письмо при каждой онлайн-записи. Сайт отправляет его с вашего почтового ящика.',
    'Checking…': 'Проверяем…',
    'Off: no booking emails yet': 'Выключено: письма о записях не отправляются',
    'Send booking emails to': 'Куда отправлять письма о записях',
    'Your email provider': 'Ваш почтовый сервис',
    'Brevo (email service, works on any hosting)': 'Brevo (почтовый сервис, работает на любом хостинге)',
    'Gmail': 'Gmail',
    'Outlook / Hotmail (Microsoft)': 'Outlook / Hotmail (Microsoft)',
    'Microsoft 365 (work email on your own domain)': 'Microsoft 365 (рабочая почта на вашем домене)',
    'Yahoo': 'Yahoo',
    'iCloud': 'iCloud',
    'Other (e.g. your web host)': 'Другой (например, почта хостинга)',
    'Send from (email account)': 'Отправитель (почтовый ящик)',
    'Send from (your verified Brevo sender)': 'Отправитель (подтверждённый в Brevo)',
    'App password': 'Пароль приложения',
    'App-specific password': 'Пароль для приложения',
    'Brevo API key': 'API-ключ Brevo',
    'Mail server (SMTP)': 'Почтовый сервер (SMTP)',
    'Port': 'Порт',
    'Save & send test email': 'Сохранить и отправить тестовое письмо',
    'Turn off': 'Выключить',
    'Saving…': 'Сохраняем…',
    'Saved. Sending a test email…': 'Сохранено. Отправляем тестовое письмо…',
    'Saved (leave blank to keep it)': 'Сохранён (оставьте пустым, чтобы не менять)',
    'Booking emails are off.': 'Письма о записях выключены.',
    'Turn off booking emails?': 'Выключить письма о записях?',
    'New bookings will still show here, but no email will be sent.': 'Новые записи по-прежнему будут видны здесь, но письма отправляться не будут.',
    'Send test email': 'Отправить тестовое письмо',
    'Sending…': 'Отправляем…',
    '📧 Booking emails are off. Turn them on in the Emails tab.': '📧 Письма о записях выключены. Включите их во вкладке «Письма».',
    '📧 Checking booking emails…': '📧 Проверяем письма о записях…',
    'The server took too long to answer (the website host timed out).': 'Сервер слишком долго не отвечал (истекло время ожидания хостинга).',
    'Enter the email address that should get booking emails.': 'Укажите адрес, на который отправлять письма о записях.',
    'Use at most 5 addresses.': 'Не более 5 адресов.',
    'One of the “send to” addresses doesn’t look right.': 'Один из адресов получателей указан неверно.',
    'Enter the mail server (for example smtp.gmail.com).': 'Укажите почтовый сервер (например, smtp.gmail.com).',
    'The port should be 465 or 587.': 'Порт должен быть 465 или 587.',
    'Enter the email account that sends the emails.': 'Укажите почтовый ящик отправителя.',
    'Enter the password (for Gmail, an app password).': 'Укажите пароль (для Gmail — пароль приложения).',
    'That password is too long.': 'Слишком длинный пароль.',
    'Enter the sender email you verified in Brevo.': 'Укажите адрес отправителя, подтверждённый в Brevo.',
    'Paste your Brevo API key.': 'Вставьте API-ключ Brevo.',
    'That’s Brevo’s SMTP key. Create an API key instead (it starts with xkeysib-).': 'Это SMTP-ключ Brevo. Создайте API-ключ (он начинается с xkeysib-).',
    'That doesn’t look like a Brevo API key (it starts with xkeysib-).': 'Это не похоже на API-ключ Brevo (он начинается с xkeysib-).',
    'Booking emails aren’t set up yet. Fill in the Emails tab and click Save.': 'Письма о записях ещё не настроены. Заполните вкладку «Письма» и нажмите «Сохранить».',
    'Please wait a few seconds before sending another test.': 'Подождите несколько секунд перед следующей проверкой.',
  };

  // Weekday names on their own (hours table, admin) and short forms (booking day strip).
  Object.keys(WD).forEach(function (d) { RU[d] = cap(WD[d]); });
  'Sun Mon Tue Wed Thu Fri Sat'.split(' ').forEach(function (d, i) { RU[d] = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][i]; });
  'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ').forEach(function (m, i) { RU[m] = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'][i]; });

  var DAYS_RE = '(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
  var t = function (s) { var r = RU[s]; return r == null ? s : r; };
  var LABELS = { 'Break between appointments (minutes)': 'Перерыв между клиентами (минуты)', 'Minimum notice (minutes)': 'Минимум заранее (минуты)', 'Booking window (days)': 'Период записи (дни)' };

  // Text with names, dates, times or prices in it.
  var PATTERNS = [
    [/^Book (.+), (\d+) minutes, \$(\d+)$/, function (m, s, d, p) { return 'Записаться: ' + t(s) + ', ' + d + ' мин, $' + p; }],
    [/^from \$(\d+)$/, function (m, p) { return 'от $' + p; }],
    [/^(\d+)% new-client discount$/, function (m, p) { return 'скидка ' + p + '% для новых клиентов'; }],
    [/^Available times · (.+)$/, function (m, d) { return 'Свободное время · ' + fragments(d); }],
    [/^(.+) \((\d+) min, \$(\d+(?:\.\d+)?)\) on (.+) at (.+)\. We'll see you at 70 Elgin Meadows Way SE\.$/, function (m, s, d, p, day, time) {
      return t(s) + ' (' + d + ' мин, $' + p + '): ' + fragments(day) + ' в ' + fragments(time) + '. Ждём вас по адресу 70 Elgin Meadows Way SE.';
    }],
    [/^(.+) at$/, function (m, d) { return fragments(d) + ' в'; }],
    [/^to (\d.+)$/, function (m, x) { return 'до ' + fragments(x); }],
    [new RegExp('^' + DAYS_RE + '( – ' + DAYS_RE + ')?$'), function (m, a, b, c) { return cap(WD[a]) + (c ? ' – ' + WD[c] : ''); }],
    [new RegExp('^' + DAYS_RE + ' (opening|closing) time$'), function (m, d, w) { return cap(WD[d]) + ': ' + (w === 'opening' ? 'открытие' : 'закрытие'); }],
    [new RegExp('^' + DAYS_RE + ': closing must be at least 30 minutes after opening\\.$'), function (m, d) { return cap(WD[d]) + ': закрытие должно быть хотя бы через 30 минут после открытия.'; }],
    [new RegExp('^' + DAYS_RE + ': enter an opening and closing time\\.$'), function (m, d) { return cap(WD[d]) + ': укажите время открытия и закрытия.'; }],
    [/^(.+) must be between (\d+) and (\d+)\.$/, function (m, l, a, b) { return (LABELS[l] || l) + ': от ' + a + ' до ' + b + '.'; }],
    [/^Cancel the booking for (.+)\?$/, function (m, n) { return 'Отменить запись клиента ' + n + '?'; }],
    [/^(.+) will be blocked for new bookings\. Existing appointments stay booked\.$/, function (m, d) { return cap(fragments(d)) + ': новые записи на этот день будут закрыты. Уже существующие записи сохранятся.'; }],
    [/^Take (today|tomorrow) off\??$/, function (m, d) { return d === 'today' ? 'Выходной сегодня' + (m.slice(-1) === '?' ? '?' : '') : 'Выходной завтра' + (m.slice(-1) === '?' ? '?' : ''); }],
    [/^Done\. Nobody can book (today|tomorrow) now\.$/, function (m, d) { return 'Готово. На ' + (d === 'today' ? 'сегодня' : 'завтра') + ' больше никто не сможет записаться.'; }],
    [/^Request failed \(error (\d+)\)\.$/, function (m, c) { return 'Ошибка запроса (код ' + c + ').'; }],
    [/^Saved, and a test email was sent to (.+)\. Check the inbox \(and the spam folder\)\.$/, function (m, a) { return 'Сохранено, тестовое письмо отправлено на ' + a + '. Проверьте входящие (и папку «Спам»).'; }],
    [/^Saved, but the test email didn’t go through\. (.+)$/, function (m, r) { return 'Сохранено, но тестовое письмо не отправлено. ' + translate(r); }],
    [/^Sent to (.+)\. Check the inbox \(and spam folder\)\.$/, function (m, a) { return 'Отправлено на ' + a + '. Проверьте входящие (и папку «Спам»).'; }],
    [/^The test email couldn’t be sent\. (.+)$/, function (m, r) { return 'Не удалось отправить тестовое письмо. ' + translate(r); }],
    [/^✓ On: new bookings are emailed to (.+)$/, function (m, a) { return '✓ Включено: письма о новых записях приходят на ' + a; }],
    [/^📧 New bookings are emailed to (.+)\.$/, function (m, a) { return '📧 Письма о новых записях приходят на ' + a + '.'; }],
    [/^Couldn’t connect to (.+?) \(tried (?:ports? )(.+?)\)\. Your website’s hosting is probably blocking outgoing email.*?\((.*)\)$/, function (m, h, p, e) { return 'Не удалось подключиться к ' + h + ' (порты ' + p.replace(' and ', ' и ') + '). Скорее всего, хостинг сайта блокирует исходящую почту: так делают некоторые тарифы, например бесплатные тарифы Render и Railway. Поможет платный тариф или другой хостинг. (' + e + ')'; }],
    [/^The mail server “(.+)” wasn’t found\. Check the server name\.$/, function (m, h) { return 'Почтовый сервер «' + h + '» не найден. Проверьте имя сервера.'; }],
    [/^The mail server’s security certificate doesn’t match “(.+)”\./, function (m, h) { return 'Сертификат безопасности почтового сервера не соответствует «' + h + '». Укажите точное имя сервера от вашего почтового сервиса.'; }],
    [/^Microsoft didn’t accept the login\..*\((.*)\)$/, function (m, e) { return 'Microsoft не принял вход. Microsoft отключает вход по паролю для отправки писем с сайтов, поэтому даже верный пароль может быть отклонён. Проще всего отправлять через бесплатный аккаунт Gmail (выберите Gmail во вкладке «Письма»); письма всё равно могут приходить на ваш адрес Microsoft. (' + e + ')'; }],
    [/^Gmail didn’t accept the login\..*\((.*)\)$/, function (m, e) { return 'Gmail не принял вход. Проверьте адрес Gmail и используйте 16-значный пароль приложения, а не обычный пароль (нужна включённая двухэтапная проверка). (' + e + ')'; }],
    [/^The mail server didn’t accept the login\..*\((.*)\)$/, function (m, e) { return 'Почтовый сервер не принял вход. Проверьте адрес и пароль. (' + e + ')'; }],
    [/^The mail server won’t send from that address\..*\((.*)\)$/, function (m, e) { return 'Почтовый сервер не отправляет письма с этого адреса. Укажите тот же адрес, с которым входите. (' + e + ')'; }],
    [/^Brevo blocked the website because it doesn’t recognise its IP address\..*\((.*)\)$/, function (m, e) { return 'Brevo заблокировал сайт, потому что не узнал его IP-адрес. В Brevo откройте своё имя (справа вверху) → Security → Authorised IPs и отключите блокировку неизвестных IP-адресов, затем сохраните здесь ещё раз. (' + e + ')'; }],
    [/^Brevo didn’t accept the API key\..*\((.*)\)$/, function (m, e) { return 'Brevo не принял API-ключ. В Brevo откройте своё имя (справа вверху) → SMTP & API → API Keys, создайте новый ключ и вставьте его сюда. (' + e + ')'; }],
    [/^Brevo won’t send from (\S+) yet\..*\((.*)\)$/, function (m, a, e) { return 'Brevo пока не отправляет письма с ' + a + '. В Brevo откройте своё имя (справа вверху) → Senders, Domains & Dedicated IPs → Senders, добавьте ' + a + ' и перейдите по ссылке из письма Brevo. (' + e + ')'; }],
    [/^Brevo hasn’t activated sending for this account yet\..*\((.*)\)$/, function (m, e) { return 'Brevo ещё не активировал отправку для этого аккаунта. Проверьте письма от Brevo или обратитесь в поддержку Brevo. (' + e + ')'; }],
    [/^Couldn’t reach Brevo: (.+)$/, function (m, e) { return 'Нет связи с Brevo: ' + e; }],
  ];

  // Dates ("Wednesday, October 7[, 2026]"), 12-hour times and "min" inside any text.
  function fragments(s) {
    return s
      .replace(new RegExp(DAYS_RE + ', (January|February|March|April|May|June|July|August|September|October|November|December) (\\d{1,2})(?:, (\\d{4}))?', 'g'), function (m, d, mo, n, y) {
        return WD[d] + ', ' + n + ' ' + MO[mo] + (y ? ' ' + y + ' г.' : '');
      })
      .replace(/\b(\d{1,2}):(\d{2})\s?(am|pm)\b/gi, function (m, h, mi, ap) { return ((+h % 12) + (ap.toLowerCase() === 'pm' ? 12 : 0)) + ':' + mi; })
      .replace(/(\d)\s?min\b/g, '$1 мин');
  }

  function translate(s) {
    var key = s.replace(/\s+/g, ' ').trim();
    if (!key) return s;
    var out = RU[key];
    if (out == null) {
      for (var i = 0; i < PATTERNS.length && out == null; i++) {
        var m = key.match(PATTERNS[i][0]);
        if (m) out = PATTERNS[i][1].apply(null, m);
      }
    }
    if (out == null) {
      // Several sentences joined together (e.g. a list of form errors).
      var parts = (key.match(/[^.!?]+[.!?]+/g) || []).map(function (p) { return p.trim(); });
      if (parts.length > 1 && parts.join(' ') === key) {
        var done = parts.map(function (p) { return RU[p]; });
        if (done.every(function (p) { return p != null; })) out = done.join(' ');
      }
    }
    if (out == null) {
      var f = fragments(key);
      if (f !== key) out = f;
    }
    if (out == null) return s;
    out = fragments(out);
    // Dates at the start of a line read better capitalised ("Среда, 7 октября").
    if (/^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье),/.test(out)) out = cap(out);
    return s.match(/^\s*/)[0] + out + s.match(/\s*$/)[0];
  }

  // ---------- Applying it to the page ----------
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var lang = 'en';
  var orig = new WeakMap();      // text node -> English text
  var wrote = new WeakMap();     // text node -> text we last put there
  var attrOrig = new WeakMap();  // element -> { attr: English }
  var titleEn = document.title;
  var meta = document.querySelector('meta[name="description"]');
  var metaEn = meta && meta.content;

  // Text inside a textarea is what the visitor typed; its placeholder is still translated.
  function skip(el) { return !el || el.closest('script, style, noscript, [data-i18n-skip]'); }

  function doText(n) {
    if (skip(n.parentElement) || n.parentElement.closest('textarea')) return;
    if (lang === 'ru') {
      if (!orig.has(n) || n.data !== wrote.get(n)) orig.set(n, n.data);
      var ru = translate(orig.get(n));
      if (ru !== n.data) n.data = ru;
      wrote.set(n, n.data);
    } else if (orig.has(n)) {
      if (n.data === wrote.get(n)) n.data = orig.get(n);
      orig.delete(n); wrote.delete(n);
    }
  }
  function doAttrs(el) {
    if (skip(el)) return;
    var saved = attrOrig.get(el);
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var v = el.getAttribute(a);
      if (lang === 'ru') {
        if (!saved) { saved = {}; attrOrig.set(el, saved); }
        if (!(a in saved) || v !== saved[a + ':ru']) saved[a] = v;
        var ru = translate(saved[a]);
        saved[a + ':ru'] = ru;
        if (ru !== v) el.setAttribute(a, ru);
      } else if (saved && a in saved) {
        if (v === saved[a + ':ru']) el.setAttribute(a, saved[a]);
      }
    });
    if (lang === 'en') attrOrig.delete(el);
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) doAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }

  var observer = new MutationObserver(function (records) {
    if (lang !== 'ru') return;
    records.forEach(function (r) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') { if (r.target.data !== wrote.get(r.target)) doText(r.target); }
      else if (r.type === 'attributes') doAttrs(r.target);
    });
  });

  function setLang(l) {
    l = l === 'ru' ? 'ru' : 'en';
    if (l === lang && document.documentElement.lang === (l === 'ru' ? 'ru' : 'en')) return;
    lang = l;
    document.documentElement.lang = l;
    walk(document.body);
    document.title = l === 'ru' ? translate(titleEn) : titleEn;
    if (meta) meta.content = l === 'ru' ? translate(metaEn) : metaEn;
    // Embedded Google map in the matching language.
    document.querySelectorAll('iframe[src*="google.com/maps"]').forEach(function (f) {
      var src = f.getAttribute('src').replace(/&hl=\w+/, '') + '&hl=' + l;
      if (src !== f.getAttribute('src')) f.setAttribute('src', src);
    });
    document.dispatchEvent(new CustomEvent('fenix:lang', { detail: l }));
  }

  function themeLang() {
    var box = document.getElementById('theme-toggle');
    if (box) return box.checked ? 'en' : 'ru';
    try { return localStorage.getItem('theme') === 'light' ? 'ru' : 'en'; } catch (e) { return 'en'; }
  }

  window.FenixI18n = { setLang: setLang, translate: translate, get lang() { return lang; } };

  function start() {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    setLang(themeLang());
    document.documentElement.classList.remove('i18n-pending');
    var box = document.getElementById('theme-toggle');
    if (box) box.addEventListener('change', function () { setLang(themeLang()); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
