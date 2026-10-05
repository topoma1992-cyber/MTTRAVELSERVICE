update staff_alerts
set notify_email = 'info@mttravelservice.com',
    smtp_user = 'info@mttravelservice.com',
    smtp_pass = ''
where notify_email = 'toponoleggio@gmail.com'
   or smtp_user = 'toponoleggio@gmail.com';
