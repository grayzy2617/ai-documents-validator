from database import SessionLocal, engine
import models
from auth_utils import get_password_hash

def run():
    # Tạo bảng nếu chưa có
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # ==================== TẠO ROLES MỚI (v2.0) ====================
        # BGH (Ban Giám Hiệu) — trước đây là ADMIN
        bgh_role = db.query(models.Role).filter_by(role_name="BGH").first()
        if not bgh_role:
            bgh_role = models.Role(role_name="BGH", description="Ban Giám Hiệu")
            db.add(bgh_role)
            db.commit()

        # TO_TRUONG (Tổ trưởng chuyên môn) — trước đây là REVIEWER
        to_truong_role = db.query(models.Role).filter_by(role_name="TO_TRUONG").first()
        if not to_truong_role:
            to_truong_role = models.Role(role_name="TO_TRUONG", description="Tổ trưởng chuyên môn")
            db.add(to_truong_role)
            db.commit()

        # GIAO_VIEN (Giáo viên) — trước đây là USER
        gv_role = db.query(models.Role).filter_by(role_name="GIAO_VIEN").first()
        if not gv_role:
            gv_role = models.Role(role_name="GIAO_VIEN", description="Giáo viên")
            db.add(gv_role)
            db.commit()

        # ==================== TẠO TÀI KHOẢN MẪU ====================

        # 1. Tài khoản Ban Giám Hiệu
        bgh_user = db.query(models.User).filter_by(username="bgh").first()
        if not bgh_user:
            bgh_user = models.User(
                username="bgh", 
                password=get_password_hash("123456"),
                email="bgh@truong.edu.vn",
                full_name="Nguyễn Văn Hiệu Trưởng",
                department="Ban Giám Hiệu",
                status=True
            )
            db.add(bgh_user)
            db.commit()
            
            bgh_user_role = models.UserRole(user_id=bgh_user.id, role_id=bgh_role.id)
            db.add(bgh_user_role)
            print("✅ Tạo tài khoản BGH thành công: bgh / 123456")
        else:
            bgh_user.password = get_password_hash("123456")
            print("🔄 Cập nhật mật khẩu BGH thành 123456")

        # 2. Tài khoản Tổ trưởng
        tt_user = db.query(models.User).filter_by(username="totruong").first()
        if not tt_user:
            tt_user = models.User(
                username="totruong", 
                password=get_password_hash("123456"),
                email="totruong@truong.edu.vn",
                full_name="Trần Thị Tổ Trưởng",
                department="Tổ Toán - Tin",
                status=True
            )
            db.add(tt_user)
            db.commit()
            
            tt_user_role = models.UserRole(user_id=tt_user.id, role_id=to_truong_role.id)
            db.add(tt_user_role)
            print("✅ Tạo tài khoản Tổ trưởng thành công: totruong / 123456")
        else:
            tt_user.password = get_password_hash("123456")
            print("🔄 Cập nhật mật khẩu Tổ trưởng thành 123456")
            
        # 3. Tài khoản Giáo viên
        gv_user = db.query(models.User).filter_by(username="giaovien").first()
        if not gv_user:
            gv_user = models.User(
                username="giaovien", 
                password=get_password_hash("123456"),
                email="giaovien@truong.edu.vn",
                full_name="Lê Văn Giáo Viên",
                department="Tổ Toán - Tin",
                status=True
            )
            db.add(gv_user)
            db.commit()
            
            gv_user_role = models.UserRole(user_id=gv_user.id, role_id=gv_role.id)
            db.add(gv_user_role)
            print("✅ Tạo tài khoản Giáo viên thành công: giaovien / 123456")
        else:
            gv_user.password = get_password_hash("123456")
            print("🔄 Cập nhật mật khẩu Giáo viên thành 123456")

        db.commit()
        
        print("\n📋 DANH SÁCH TÀI KHOẢN:")
        print("=" * 50)
        print(f"  BGH:       bgh / 123456")
        print(f"  Tổ trưởng: totruong / 123456")
        print(f"  Giáo viên: giaovien / 123456")
        print("=" * 50)

    except Exception as e:
        print("❌ Lỗi:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()