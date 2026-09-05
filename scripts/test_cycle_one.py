"""End-to-end HTTP contract checks against the real backend in a disposable DB."""
from fastapi.testclient import TestClient
from qa_backend import app, ADMIN_EMAIL, CLIENT_EMAIL, PASSWORD, mailbox

client = TestClient(app)
checks = 0
auth = {}

def call(method, path, body=None, *, public=False, status=200):
    global checks
    response = client.request(method, '/api/v1' + path, json=body, headers={} if public else auth)
    assert response.status_code == status, (method, path, response.status_code, response.text)
    checks += 1
    value = response.json()
    if status < 300:
        assert value['success'] is True
        return value['data']
    return value

def create(path, body):
    return call('POST', path, body, status=201)

tokens = call('POST','/auth/login',{'email':ADMIN_EMAIL,'password':PASSWORD},public=True)
auth = {'Authorization':'Bearer ' + tokens['access_token']}
call('GET','/auth/me')
for path in ['/catalog/products','/catalog/categories','/catalog/sizes','/catalog/colors','/catalog/seasons','/catalog/collections','/public/branches']:
    call('GET',path,public=True)
call('GET','/users',public=True,status=401)
roles = call('GET','/roles')
client_role = next(r for r in roles if r['code']=='client')
perm = create('/roles/permissions',{'code':'qa.read','name':'Consultar QA','module':'qa'})
call('PATCH','/roles/permissions/'+perm['id'],{'name':'Lectura QA'})
role = create('/roles',{'code':'qa_reader','name':'Lector de prueba','permission_ids':[perm['id']]})
call('PUT',f"/roles/{role['id']}/permissions",{'permission_ids':[]})
call('PATCH',f"/roles/{role['id']}",{'name':'Lector actualizado'})
for action in ['deactivate','activate']:
    call('POST',f"/roles/{role['id']}/{action}")
    call('POST',f"/roles/permissions/{perm['id']}/{action}")
user = create('/users',{'email':'employee@example.com','password':PASSWORD,'first_name':'Usuario','last_name':'Prueba','role_ids':[client_role['id']]})
call('PATCH',f"/users/{user['id']}",{'phone':'70000123'})
call('PUT',f"/users/{user['id']}/roles",{'role_ids':[role['id']]})
call('GET','/users?search=employee&role_code=qa_reader')
for action in ['deactivate','activate','unlock']:
    call('POST',f"/users/{user['id']}/{action}")
call('DELETE',f"/users/{user['id']}")
call('GET','/users?include_deleted=true')
call('POST',f"/users/{user['id']}/restore")
call('PUT',f"/users/{user['id']}/roles",{'role_ids':[client_role['id']]})
call('DELETE',f"/roles/{role['id']}")
call('DELETE',f"/roles/permissions/{perm['id']}")

masters = {}
for resource,body in [
    ('categories',{'name':'Prendas de prueba'}),('sizes',{'code':'M','name':'Mediana','sort_order':1}),
    ('colors',{'name':'Arena','hex_code':'#B99B79'}),('seasons',{'name':'Primavera QA','start_date':'2026-09-01','end_date':'2026-12-01'}),
]:
    path='/catalog/admin/'+resource
    masters[resource]=create(path,body)
    call('GET',path+'/'+masters[resource]['id'])
    call('PATCH',path+'/'+masters[resource]['id'],{'name':body['name']+' editada'})
    for action in ['deactivate','activate']:call('POST',path+'/'+masters[resource]['id']+'/'+action)
masters['collections']=create('/catalog/admin/collections',{'name':'Colección QA','season_id':masters['seasons']['id']})
city=create('/organization/cities',{'name':'Ciudad QA','department':'Santa Cruz','country':'Bolivia'})
supplier=create('/organization/suppliers',{'business_name':'Proveedor QA','tax_id':'QA12345'})
branch=create('/organization/branches',{'code':'QA-01','name':'Sucursal QA','city_id':city['id'],'address':'Avenida Prueba 123','opening_hours':{'monday':{'open':'09:00','close':'18:00'}}})
cash=create('/organization/cash-points',{'code':'QA-C1','name':'Caja QA','branch_id':branch['id']})
for key,record in [('cities',city),('suppliers',supplier),('branches',branch),('cash-points',cash)]:
    call('GET','/organization/'+key)
    call('GET','/organization/'+key+'/'+record['id'])
    call('PATCH','/organization/'+key+'/'+record['id'],{'business_name':'Proveedor editado'} if key=='suppliers' else {'name':record['name']+' editada'})

product=create('/catalog/admin/products',{'name':'Camisa QA','description':'Prenda para pruebas del ciclo uno','base_price':150,'category_id':masters['categories']['id'],'season_id':masters['seasons']['id'],'collection_id':masters['collections']['id'],'brand':'QA','is_featured':True})
path='/catalog/admin/products/'+product['id']
product=call('POST',path+'/variants',{'size_id':masters['sizes']['id'],'color_id':masters['colors']['id'],'sku':'QA-M-ARENA','price_override':175})
variant=product['variants'][0]
call('PATCH',path+'/variants/'+variant['id'],{'price_override':0,'is_active':True})
product=call('POST',path+'/images',{'url':'https://example.com/qa.jpg','alt_text':'Imagen de prueba','is_primary':True,'sort_order':0})
image=product['images'][0]
product=call('POST',path+'/ar-assets',{'asset_type':'glb','asset_url':'https://example.com/qa.glb'})
product=call('GET',path)
asset=product['ar_assets'][0]
call('PUT',path+'/suppliers',{'suppliers':[{'supplier_id':supplier['id'],'unit_cost':70,'is_primary':True}]})
call('PATCH',path,{'base_price':155,'description':'Descripción actualizada de prueba'})
public=call('GET','/catalog/products/'+product['slug'],public=True)
assert 'suppliers' not in public
page=call('GET',f"/catalog/products?search=Camisa&size_id={masters['sizes']['id']}&color_id={masters['colors']['id']}&min_price=0&max_price=200&featured=true",public=True)
assert page['total']==1
call('DELETE',path+'/images/'+image['id'])
call('DELETE',path+'/ar-assets/'+asset['id'])
call('DELETE',path+'/variants/'+variant['id'])
call('PUT',path+'/suppliers',{'suppliers':[]})
call('POST',path+'/deactivate')
call('GET','/catalog/products/'+product['slug'],public=True,status=404)
call('POST',path+'/activate')
call('DELETE',path)
call('POST',path+'/activate')
call('GET','/catalog/admin/products?include_deleted=true')
call('POST','/organization/branches/'+branch['id']+'/deactivate')
assert call('GET','/organization/cash-points/'+cash['id'])['is_active'] is False
call('POST','/organization/cash-points/'+cash['id']+'/activate',status=409)
call('POST','/organization/branches/'+branch['id']+'/activate')
call('POST','/organization/cash-points/'+cash['id']+'/activate')
for key,record in [('suppliers',supplier),('cash-points',cash),('branches',branch)]:
    call('DELETE','/organization/'+key+'/'+record['id'])
    call('POST','/organization/'+key+'/'+record['id']+'/activate')
events=call('GET','/audit-log?page_size=10')
assert events['total']>0
call('GET','/audit-log/'+events['items'][0]['id'])
renewed=call('POST','/auth/refresh',{'refresh_token':tokens['refresh_token']},public=True)
assert renewed['refresh_token']!=tokens['refresh_token']
call('POST','/auth/logout',{'refresh_token':renewed['refresh_token']},public=True)

registration=call('POST','/auth/register',{'email':'new-client@example.com','password':PASSWORD,'first_name':'Cliente','last_name':'Nuevo'},public=True,status=201)
call('POST','/auth/verify-email',{'token':mailbox[('new-client@example.com','verification')]},public=True)
client_tokens=call('POST','/auth/login',{'email':'new-client@example.com','password':PASSWORD},public=True)
auth={'Authorization':'Bearer '+client_tokens['access_token']}
call('GET','/catalog/admin/products',status=403)
address=create('/users/me/addresses',{'label':'Casa','recipient_name':'Cliente Nuevo','phone':'70000000','city':'Santa Cruz','address_line':'Calle Prueba 123','is_default':True})
call('GET','/users/me/addresses')
call('PATCH','/users/me/addresses/'+address['id'],{'reference':'Puerta azul'})
call('DELETE','/users/me/addresses/'+address['id'])
call('POST','/auth/change-password',{'current_password':PASSWORD,'new_password':'CambioSeguro!2026'})
call('POST','/auth/forgot-password',{'email':'new-client@example.com'},public=True)
call('POST','/auth/reset-password',{'token':mailbox[('new-client@example.com','reset')],'new_password':'NuevaClaveFinal!2026'},public=True)
call('POST','/auth/login',{'email':'new-client@example.com','password':'NuevaClaveFinal!2026'},public=True)
call('POST','/auth/resend-verification',{'email':'new-client@example.com'},public=True)
print(f'{checks} comprobaciones HTTP aprobadas. Ciclo I: CU01-CU08, direcciones, bitácora y sesión. DB descartada al salir.')

