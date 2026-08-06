-- 修正台東1館公區保養「懶人肩頭保養」錯字，應為「懶骨頭保養」
update public_area_maintenance_templates
set task_name = '懶骨頭保養-椅套、本體'
where branch_id = (select id from branches where code = 'TT1')
  and task_name = '懶人肩頭保養-椅套、本體';
